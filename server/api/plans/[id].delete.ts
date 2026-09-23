import { db } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('plans').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Plan no encontrado' });
  }
  const membersOnPlan = await db()
    .collection('users')
    .where('membership_plan_id', '==', id)
    .count()
    .get();
  if (membersOnPlan.data().count > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `No se puede eliminar: ${membersOnPlan.data().count} socio(s) tienen este plan`,
    });
  }
  await ref.delete();
  return { ok: true };
});
