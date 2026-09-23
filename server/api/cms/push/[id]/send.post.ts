import { Timestamp } from 'firebase-admin/firestore';

import type { PushLog } from '#shared/types';

import { db, toPushLog } from '../../../../utils/db';
import { useAdmin } from '../../../../utils/firebase-admin';
import { requireAdmin, requireStaff } from '../../../../utils/staff-auth';

/// Audiencia → topic FCM. La app suscribe `all_members` + `branch_{id}`
/// + `expired_members` según su perfil — no hace falta guardar tokens.
function topicFor(log: FirebaseFirestore.DocumentData): string {
  const audience = String(log.audience ?? 'ALL');
  const branchId = log.branch_id as string | null | undefined;
  if (audience === 'BRANCH' && branchId) {
    return `branch_${branchId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  if (audience === 'EXPIRED') return 'expired_members';
  return 'all_members';
}

export default defineEventHandler(async (event): Promise<PushLog> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('pushLogs').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Notificación no encontrada' });
  }
  const log = snap.data() ?? {};

  /// Envío real por FCM al topic de la audiencia. El conteo `sent` es
  /// estimado — FCM no expone suscriptores por topic.
  let sent = 0;
  let fcmError: string | null = null;
  try {
    await useAdmin().messaging.send({
      topic: topicFor(log),
      notification: {
        title: String(log.title ?? ''),
        body: String(log.body ?? ''),
      },
      data: {
        kind: String(log.kind ?? 'BRAND'),
        branch_id: String(log.branch_id ?? ''),
      },
    });
    sent = log.audience === 'EXPIRED' ? 0 : 1; // envío aceptado por FCM
  } catch (error) {
    fcmError = error instanceof Error ? error.message : String(error);
  }

  await ref.update({
    status: fcmError ? 'FAILED' : 'SENT',
    sent,
    fcm_topic: topicFor(log),
    fcm_error: fcmError,
    created_at: Timestamp.now(),
  });

  if (fcmError) {
    throw createError({
      statusCode: 502,
      message: `FCM rechazó el envío: ${fcmError}`,
    });
  }
  return toPushLog(await ref.get());
});
