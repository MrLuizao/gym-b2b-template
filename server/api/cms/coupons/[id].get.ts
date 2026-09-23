import type { Coupon } from '#shared/types';

import { db, toCoupon } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Coupon> => {
  await requireStaff(event);
  const snap = await db()
    .collection('promotions')
    .doc(getRouterParam(event, 'id') ?? '')
    .get();
  if (!snap.exists || snap.data()?.type !== 'coupon') {
    throw createError({ statusCode: 404, statusMessage: 'Cupón no encontrado' });
  }
  return toCoupon(snap);
});
