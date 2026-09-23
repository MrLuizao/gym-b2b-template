import type { Coupon } from '#shared/types';

import { allPlans, db, toCoupon } from '../../../utils/db';
import { requireAdmin, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Coupon> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('promotions').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.type !== 'coupon') {
    throw createError({ statusCode: 404, statusMessage: 'Cupón no encontrado' });
  }

  const body = await readBody<{
    title?: string;
    description?: string;
    badge?: string;
    code?: string;
    planIds?: string[];
    branchId?: string | null;
  }>(event);

  const update: Record<string, unknown> = {};
  if (body?.title !== undefined && body.title.trim()) update.title = body.title.trim().slice(0, 80);
  if (body?.description !== undefined) update.description = body.description.trim().slice(0, 200);
  if (body?.badge !== undefined) update.badge = body.badge.trim().slice(0, 12) || 'NUEVO';
  if (body?.code !== undefined && body.code.trim()) update.code = body.code.trim().toUpperCase().slice(0, 24);
  if (body?.planIds !== undefined && Array.isArray(body.planIds)) {
    const valid = new Set((await allPlans()).map((p) => p.id));
    const targets = body.planIds.filter(
      (p): p is string => typeof p === 'string' && (p === 'ALL' || valid.has(p)),
    );
    if (targets.length > 0) update.plan_ids = targets;
  }
  if (body?.branchId !== undefined) update.branch_id = body.branchId || null;

  if (Object.keys(update).length > 0) await ref.update(update);
  return toCoupon(await ref.get());
});
