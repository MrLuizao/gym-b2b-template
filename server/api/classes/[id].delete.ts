import { db } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('classes').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }
  await ref.delete();
  return { ok: true };
});
