import type { Coupon } from '#shared/types';

import { db, toCoupon } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Coupon> => {
  const staff = await requireStaff(event);
  if (staff.role === 'RECEPTIONIST') {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' });
  }
  const snap = await db()
    .collection('promotions')
    .doc(getRouterParam(event, 'id') ?? '')
    .get();
  if (!snap.exists || snap.data()?.type !== 'coupon') {
    throw createError({ statusCode: 404, statusMessage: 'Cupón no encontrado' });
  }
  return toCoupon(snap);
});
