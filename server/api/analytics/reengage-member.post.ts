import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineEventHandler, readBody } from 'h3';
import { getBusinessFeatures } from '../../utils/config';
import { useAdmin } from '../../utils/firebase-admin';
import { requireBranchScope, requireStaff } from '../../utils/staff-auth';

/**
 * POST /api/analytics/reengage-member
 * Acciones directas de retención hacia un socio en riesgo:
 * - 'push': Envía notificación push FCM directa al topic personal `member_{id}`
 * - 'ticket': Inicia un hilo de soporte proactivo en `/conversations`
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);
  const featuresConfig = await getBusinessFeatures();
  if (!featuresConfig.ai_churn_prediction?.enabled) {
    throw createError({ statusCode: 403, statusMessage: 'Módulo de Retención IA no habilitado' });
  }
  const db = getFirestore();
  const body = await readBody<{
    memberId: string;
    action: 'push' | 'ticket';
    message?: string;
  }>(event);

  if (!body?.memberId || !body?.action) {
    throw createError({ statusCode: 400, statusMessage: 'memberId y action son requeridos' });
  }

  const memberRef = db.collection('users').doc(body.memberId);
  const memberDoc = await memberRef.get();

  if (!memberDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }

  const memberData = memberDoc.data()!;
  requireBranchScope(staff, memberData.branch_id);

  const memberName = memberData.name || 'Socio';

  if (body.action === 'push') {
    const text = body.message?.trim() || `¡Hola ${memberName}! Te extrañamos en el gym. Tenemos una rutina especial para ti hoy.`;
    const topic = `member_${body.memberId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
      await useAdmin().messaging.send({
        topic,
        notification: {
          title: '¡Te extrañamos en el gym!',
          body: text,
        },
        data: {
          type: 'retention',
          target: 'home',
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      return {
        success: true,
        action: 'push',
        memberId: body.memberId,
        message: 'Push de retención enviado exitosamente',
      };
    } catch (err: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Error al enviar push FCM: ${err?.message || 'Error desconocido'}`,
      });
    }
  }

  if (body.action === 'ticket') {
    const text =
      body.message?.trim() ||
      `Hola ${memberName}, notamos que no has asistido últimamente. ¿Hay algo en lo que podamos apoyarte con tu entrenamiento o tus clases?`;

    // Buscar si ya existe una conversación abierta con el socio
    const existingSnap = await db
      .collection('conversations')
      .where('member_id', '==', body.memberId)
      .where('status', '==', 'open')
      .limit(1)
      .get();

    let convRef;
    const now = Timestamp.now();

    if (!existingSnap.empty && existingSnap.docs[0]) {
      const firstDoc = existingSnap.docs[0];
      convRef = firstDoc.ref;
      await convRef.update({
        last_message_at: now,
        last_message_preview: text,
        unread_member: (firstDoc.data().unread_member || 0) + 1,
      });
    } else {
      convRef = db.collection('conversations').doc();
      await convRef.set({
        member_id: body.memberId,
        member_name: memberName,
        branch_id: memberData.branch_id || staff.branchId,
        status: 'open',
        created_at: now,
        last_message_at: now,
        last_message_preview: text,
        unread_member: 1,
        unread_staff: 0,
      });
    }

    // Agregar mensaje
    await convRef.collection('messages').add({
      sender: 'staff',
      sender_name: staff.email.split('@')[0] || 'Recepción',
      text,
      created_at: now,
      read: false,
    });

    // Enviar push para notificar al socio que soporte le escribió
    try {
      const topic = `member_${body.memberId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      await useAdmin().messaging.send({
        topic,
        notification: {
          title: 'Mensaje de tu gimnasio',
          body: text,
        },
        data: {
          type: 'support',
          conversation_id: convRef.id,
        },
      });
    } catch {
      // Ignorar fallo de push si el ticket se creó bien
    }

    return {
      success: true,
      action: 'ticket',
      conversationId: convRef.id,
      message: 'Ticket de atención creado exitosamente',
    };
  }

  throw createError({ statusCode: 400, statusMessage: 'Acción no soportada' });
});
