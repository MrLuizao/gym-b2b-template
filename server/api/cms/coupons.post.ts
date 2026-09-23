import { Timestamp } from 'firebase-admin/firestore';

import type { Coupon } from '#shared/types';

import { allPlans, db, toCoupon } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Coupon> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<{
    title?: string;
    description?: string;
    badge?: string;
    code?: string;
    planIds?: string[];
    branchId?: string | null;
  }>(event);

  const title = body?.title?.trim();
  const code = body?.code?.trim();
  if (!title || !code) {
    throw createError({ statusCode: 400, statusMessage: 'Título y código son obligatorios' });
  }

  /// Segmentación por plan: 'ALL' o ids de planes existentes.
  const planIds = new Set((await allPlans()).map((p) => p.id));
  const targets = (body.planIds ?? []).filter(
    (p): p is string => typeof p === 'string' && (p === 'ALL' || planIds.has(p)),
  );

  const ref = db().collection('promotions').doc();
  await ref.set({
    type: 'coupon',
    title: title.slice(0, 80),
    description: (body.description ?? '').trim().slice(0, 140),
    badge: (body.badge ?? 'NUEVO').trim().slice(0, 12),
    code: code.toUpperCase().slice(0, 16),
    plan_ids: targets.length > 0 ? targets : ['ALL'],
    branch_id: body.branchId || null,
    created_at: Timestamp.now(),
    expires_at: null,
  });
  return toCoupon(await ref.get());
});
