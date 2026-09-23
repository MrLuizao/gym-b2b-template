import { db } from '../../../../utils/db';
import { requireAdmin, requireStaff } from '../../../../utils/staff-auth';

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const ref = db().collection('pushLogs').doc(getRouterParam(event, 'id') ?? '');
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Notificación no encontrada' });
  }
  await ref.delete();
  return { ok: true };
});
