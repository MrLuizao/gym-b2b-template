import { db } from '../../../utils/db';
import { requireAdmin, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const ref = db().collection('promotions').doc(getRouterParam(event, 'id') ?? '');
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.type !== 'coupon') {
    throw createError({ statusCode: 404, statusMessage: 'Cupón no encontrado' });
  }
  await ref.delete();
  return { ok: true };
});
