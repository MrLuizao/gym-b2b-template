import type { Coupon, MembershipLevel } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

const LEVELS: MembershipLevel[] = ['CLASSIC', 'PLUS', 'BLACK'];

export default defineEventHandler(async (event): Promise<Coupon> => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const coupon = db.coupons.find((item) => item.id === id);
  if (!coupon) {
    throw createError({ statusCode: 404, statusMessage: 'Cupón no encontrado' });
  }

  const body = await readBody<{
    title?: string;
    description?: string;
    badge?: string;
    code?: string;
    levels?: string[];
    branchId?: string | null;
  }>(event);

  if (body?.title !== undefined && body.title.trim()) {
    coupon.title = body.title.trim().slice(0, 80);
  }
  if (body?.description !== undefined) {
    coupon.description = body.description.trim().slice(0, 200);
  }
  if (body?.badge !== undefined) {
    coupon.badge = body.badge.trim().slice(0, 12) || 'NUEVO';
  }
  if (body?.code !== undefined && body.code.trim()) {
    coupon.code = body.code.trim().toUpperCase().slice(0, 24);
  }
  if (body?.levels !== undefined && Array.isArray(body.levels)) {
    const levels = body.levels.filter((l): l is MembershipLevel =>
      LEVELS.includes(l as MembershipLevel),
    );
    if (levels.length > 0) coupon.levels = levels;
  }
  if (body?.branchId !== undefined) coupon.branchId = body.branchId || null;

  return coupon;
});
