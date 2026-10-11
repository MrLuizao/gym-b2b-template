import type { PushLog } from '#shared/types';

import { db, toPushLog } from '../../../../utils/db';
import { requireStaff } from '../../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<PushLog> => {
  const staff = await requireStaff(event);
  if (staff.role === 'RECEPTIONIST') {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' });
  }
  const snap = await db()
    .collection('pushLogs')
    .doc(getRouterParam(event, 'id') ?? '')
    .get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Notificación no encontrada' });
  }
  return toPushLog(snap);
});
