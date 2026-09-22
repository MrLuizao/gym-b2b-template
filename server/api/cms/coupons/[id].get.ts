import type { Coupon } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler((event): Coupon => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const coupon = db.coupons.find((item) => item.id === id);
  if (!coupon) {
    throw createError({ statusCode: 404, statusMessage: 'Cupón no encontrado' });
  }
  return coupon;
});
