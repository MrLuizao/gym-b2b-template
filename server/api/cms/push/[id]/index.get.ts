import type { PushLog } from '#shared/types';

import { db, toPushLog } from '../../../../utils/db';
import { requireStaff } from '../../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<PushLog> => {
  await requireStaff(event);
  const snap = await db()
    .collection('pushLogs')
    .doc(getRouterParam(event, 'id') ?? '')
    .get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Notificación no encontrada' });
  }
  return toPushLog(snap);
});
