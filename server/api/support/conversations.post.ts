import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import type { Conversation } from '#shared/types';

import { db } from '../../utils/db';
import { requireMember } from '../../utils/member-auth';
import { rateLimit } from '../../utils/rate-limit';

/// El socio crea o recupera su conversación abierta.
export default defineEventHandler(async (event): Promise<Conversation> => {
  const member = await requireMember(event);
  rateLimit(`support-conv:${member.id}`, 5, 60_000);

  // Buscar conversación abierta existente
  const existing = await db()
    .collection('conversations')
    .where('member_id', '==', member.id)
    .where('status', '==', 'open')
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const d = doc.data();
    return {
      id: doc.id,
      memberId: member.id,
      memberName: member.name,
      branchId: member.branchId,
      status: 'open',
      createdAt: d.created_at?.toMillis?.() ?? Date.now(),
      lastMessageAt: d.last_message_at?.toMillis?.() ?? Date.now(),
      lastMessagePreview: String(d.last_message_preview ?? ''),
      unreadMember: Number(d.unread_member ?? 0),
      unreadStaff: Number(d.unread_staff ?? 0),
    };
  }

  // Crear nueva conversación — expires_at alimenta la TTL policy de
  // Firestore (72h sin actividad → se borra sola, mensajes incluidos).
  const ref = db().collection('conversations').doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    member_id: member.id,
    member_name: member.name,
    branch_id: member.branchId,
    status: 'open',
    created_at: now,
    last_message_at: now,
    last_message_preview: '',
    unread_member: 0,
    unread_staff: 0,
    expires_at: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
  });

  return {
    id: ref.id,
    memberId: member.id,
    memberName: member.name,
    branchId: member.branchId,
    status: 'open',
    createdAt: Date.now(),
    lastMessageAt: Date.now(),
    lastMessagePreview: '',
    unreadMember: 0,
    unreadStaff: 0,
  };
});
