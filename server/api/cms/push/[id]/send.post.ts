import type { PushLog } from '#shared/types';

import { db, toPushLog } from '../../../../utils/db';
import { sendPushDoc } from '../../../../utils/push';
import { requireAdmin, requireStaff } from '../../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<PushLog> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('pushLogs').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Notificación no encontrada' });
  }

  const { fcmError } = await sendPushDoc(snap);
  if (fcmError) {
    throw createError({
      statusCode: 502,
      message: `FCM rechazó el envío: ${fcmError}`,
    });
  }
  return toPushLog(await ref.get());
});
