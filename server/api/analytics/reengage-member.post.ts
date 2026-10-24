import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineEventHandler, readBody } from 'h3';
import type { RetentionPlaybookId } from '#shared/types';
import { getBusinessFeatures } from '../../utils/config';
import { useAdmin } from '../../utils/firebase-admin';
import { generateRetentionPlaybookMessage } from '../../utils/gemini';
import { recordPointsHistory } from '../../utils/points-history';
import { requireBranchScope, requireStaff } from '../../utils/staff-auth';

const RESCUE_BONUS_POINTS = 25;

/**
 * POST /api/analytics/reengage-member
 * Playbooks de retención asistidos por IA (Gemini + fallback contextual):
 * - `preview: true` -> Redacta y devuelve el título/mensaje personalizado sin enviarlo aún.
 * - `action: 'push'` -> Envía notificación push FCM contextual al topic `member_{id}`.
 * - `action: 'bonus_push'` -> Otorga +25 pts de rescate en transacción + envía push FCM.
 * - `action: 'ticket'` -> Inicia o actualiza hilo proactivo en `/conversations`.
 * Sella `last_retention_intervention` en `users/{id}` para medir retorno e Ingresos Salvados.
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
    action: 'push' | 'ticket' | 'bonus_push';
    playbook?: RetentionPlaybookId;
    title?: string;
    message?: string;
    preview?: boolean;
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

  const memberName = (memberData.name as string) || 'Socio';
  const feat = memberData.latest_churn_features || {};
  const playbook: RetentionPlaybookId =
    body.playbook ||
    (memberData.churn_suggested_playbook as RetentionPlaybookId) ||
    'habit_boost';

  const generated = await generateRetentionPlaybookMessage({
    memberName,
    daysSinceLastVisit: Number(feat.days_since_last_visit ?? 10),
    avgVisitsPerWeek: Number(feat.avg_visits_per_week_last_4 ?? 1.2),
    points: Number(memberData.points ?? 0),
    weeklyGoal: Number(memberData.weekly_goal ?? 4),
    playbook,
    action: body.action,
    topFactors: Array.isArray(memberData.churn_top_factors) ? memberData.churn_top_factors : [],
  });

  if (body.preview) {
    return {
      success: true,
      preview: true,
      playbook,
      action: body.action,
      title: generated.title,
      message: generated.message,
      aiPowered: generated.aiPowered,
    };
  }

  const finalTitle = body.title?.trim() || generated.title;
  const finalText = body.message?.trim() || generated.message;
  const nowIso = new Date().toISOString();

  const interventionPayload = {
    at: nowIso,
    action: body.action,
    playbook,
    staff_uid: staff.uid,
    risk_ml: Number(memberData.churn_risk_ml ?? 0),
    returned_at: null,
    converted_payment_id: null,
  };

  if (body.action === 'push' || body.action === 'bonus_push') {
    const topic = `member_${body.memberId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (body.action === 'bonus_push') {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(memberRef);
        const currentPoints = Number(snap.data()?.points ?? 0);
        tx.update(memberRef, {
          points: FieldValue.increment(RESCUE_BONUS_POINTS),
          points_earned: FieldValue.increment(RESCUE_BONUS_POINTS),
          last_retention_intervention: interventionPayload,
        });
        recordPointsHistory(tx, body.memberId, {
          type: 'manual_adjustment',
          delta: RESCUE_BONUS_POINTS,
          balance: currentPoints + RESCUE_BONUS_POINTS,
          description: 'Bono de rescate de racha (Coach IA)',
        });
      });
    } else {
      await memberRef.update({
        last_retention_intervention: interventionPayload,
      });
    }

    try {
      await useAdmin().messaging.send({
        topic,
        notification: {
          title: finalTitle,
          body: finalText,
        },
        data: {
          type: 'retention',
          target: body.action === 'bonus_push' ? 'promos' : 'home',
          playbook,
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      return {
        success: true,
        action: body.action,
        playbook,
        memberId: body.memberId,
        bonusAwarded: body.action === 'bonus_push' ? RESCUE_BONUS_POINTS : 0,
        intervention: {
          at: nowIso,
          action: body.action,
          playbook,
          returnedAt: null,
          convertedPaymentId: null,
        },
        message:
          body.action === 'bonus_push'
            ? `Bono de +${RESCUE_BONUS_POINTS} pts acreditado y Push enviado`
            : 'Push de retención enviado exitosamente',
      };
    } catch (err: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Error al enviar push FCM: ${err?.message || 'Error desconocido'}`,
      });
    }
  }

  if (body.action === 'ticket') {
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
        last_message_preview: finalText,
        unread_member: (firstDoc.data().unread_member || 0) + 1,
        expires_at: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
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
        last_message_preview: finalText,
        unread_member: 1,
        unread_staff: 0,
        expires_at: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    await convRef.collection('messages').add({
      sender: 'staff',
      sender_name: staff.email.split('@')[0] || 'Gerencia',
      text: finalText,
      created_at: now,
      read: false,
    });

    await memberRef.update({
      last_retention_intervention: interventionPayload,
    });

    try {
      const topic = `member_${body.memberId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      await useAdmin().messaging.send({
        topic,
        notification: {
          title: finalTitle || 'Mensaje de tu gimnasio',
          body: finalText,
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
      playbook,
      conversationId: convRef.id,
      intervention: {
        at: nowIso,
        action: 'ticket',
        playbook,
        returnedAt: null,
        convertedPaymentId: null,
      },
      message: 'Ticket de atención creado exitosamente',
    };
  }

  throw createError({ statusCode: 400, statusMessage: 'Acción no soportada' });
});
