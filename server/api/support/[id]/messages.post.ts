import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import type { SupportMessage } from '#shared/types';

import { getBusinessFeatures } from '../../../utils/config';
import { recordComplaintFromMessage } from '../../../utils/complaint-risk';
import { db } from '../../../utils/db';
import { useAdmin } from '../../../utils/firebase-admin';
import { requireMember } from '../../../utils/member-auth';
import { rateLimit } from '../../../utils/rate-limit';
import { requireStaff } from '../../../utils/staff-auth';

/// Envía un mensaje a la conversación — socio o staff según auth.
export default defineEventHandler(async (event): Promise<SupportMessage> => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID requerido' });
  }

  const body = await readBody<{ text?: string }>(event);
  const text = body?.text?.trim() ?? '';
  if (!text) {
    throw createError({ statusCode: 400, message: 'Mensaje vacío' });
  }

  const convRef = db().collection('conversations').doc(id);
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    throw createError({ statusCode: 404, message: 'Conversación no encontrada' });
  }
  const conv = convSnap.data()!;

  if (conv.status === 'resolved') {
    throw createError({ statusCode: 400, message: 'Conversación cerrada' });
  }

  let sender: 'member' | 'staff';
  let senderName: string;
  let unreadField: string;

  // Intentar auth como staff primero
  try {
    const staff = await requireStaff(event);
    if (staff.role !== 'ADMIN' && staff.branchId !== conv.branch_id) {
      throw createError({ statusCode: 403, message: 'Fuera de tu sede' });
    }
    sender = 'staff';
    senderName = staff.email.split('@')[0] ?? 'Staff';
    unreadField = 'unread_member';
  } catch {
    const member = await requireMember(event);
    await rateLimit(`support-msg:${member.id}`, 20, 60_000);
    if (member.id !== conv.member_id) {
      throw createError({ statusCode: 403, message: 'No es tu conversación' });
    }
    sender = 'member';
    senderName = member.name;
    unreadField = 'unread_staff';
  }

  const msgRef = convRef.collection('messages').doc();
  const now = FieldValue.serverTimestamp();
  /// TTL: cada mensaje renueva la vida de la conversación 72h; el mensaje
  /// lleva su propio expires_at porque TTL no borra subcolecciones.
  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

  await db().runTransaction(async (tx) => {
    tx.set(msgRef, {
      sender,
      sender_name: senderName,
      text,
      created_at: now,
      read: false,
      expires_at: expiresAt,
    });
    tx.update(convRef, {
      last_message_at: now,
      last_message_preview: text.slice(0, 100),
      [unreadField]: FieldValue.increment(1),
      expires_at: expiresAt,
    });
  });

  /// Socio → detección de quejas para Retención IA (solo con el módulo
  /// activo). Corre en segundo plano (`waitUntil`) para no retrasar la
  /// respuesta del chat; Gemini/keywords y la escritura son best-effort.
  if (sender === 'member') {
    const memberId = conv.member_id as string;
    const task = getBusinessFeatures()
      .then((f) => (f.ai_churn_prediction?.enabled ? recordComplaintFromMessage(memberId, text) : undefined))
      .catch(() => undefined);
    event.waitUntil(task);
  }

  /// Respuesta de staff → push al socio por topic `member_{id}` (la app
  /// se suscribe en syncTopics). Best-effort: el mensaje ya quedó
  /// guardado — si FCM falla solo se pierde la notificación.
  if (sender === 'staff') {
    try {
      await useAdmin().messaging.send({
        topic: `member_${String(conv.member_id)}`.replace(
          /[^a-zA-Z0-9_-]/g,
          '_',
        ),
        notification: {
          title: 'Respuesta de soporte',
          body: text.slice(0, 120),
        },
        data: { type: 'support', conversation_id: id },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch {
      /* sin suscriptores o error FCM — no bloquea el mensaje */
    }
  }

  return {
    id: msgRef.id,
    conversationId: id,
    sender,
    senderName,
    text,
    createdAt: Date.now(),
    read: false,
  };
});
