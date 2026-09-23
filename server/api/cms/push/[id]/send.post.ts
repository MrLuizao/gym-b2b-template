import { Timestamp } from 'firebase-admin/firestore';

import type { PushLog } from '#shared/types';

import { db, toPushLog } from '../../../../utils/db';
import { requireAdmin, requireStaff } from '../../../../utils/staff-auth';

const TOTAL_DEVICES = 1248;
const PROMO_OPT_IN_RATE = 0.68;

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

  /// Estimación de alcance por audiencia (el envío FCM real es fase 2).
  let sent = 0;
  if (log.audience === 'ALL') {
    sent = TOTAL_DEVICES;
  } else if (log.audience === 'EXPIRED') {
    const expired = await db()
      .collection('users')
      .where('membership_status', '==', 'EXPIRED')
      .count()
      .get();
    sent = expired.data().count * 37;
  } else {
    sent = 180 + Math.floor(Math.random() * 220);
  }
  if (log.kind === 'SPONSOR') sent = Math.round(sent * PROMO_OPT_IN_RATE);

  await ref.update({
    status: 'SENT',
    sent,
    created_at: Timestamp.now(),
  });
  return toPushLog(await ref.get());
});
