import type { MembershipPlan } from '#shared/types';

import { db, toPlan } from '../utils/db';
import { requireAdmin, requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<MembershipPlan> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<{
    name?: string;
    price?: number;
    features?: string[];
    highlight?: boolean;
    allBranches?: boolean;
  }>(event);

  const name = body?.name?.trim() ?? '';
  if (name.length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El nombre del plan es obligatorio (mín. 3 caracteres)',
    });
  }
  const dup = await db()
    .collection('plans')
    .where('name', '==', name)
    .limit(1)
    .get();
  if (!dup.empty) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ya existe un plan con ese nombre',
    });
  }
  if (typeof body?.price !== 'number' || body.price < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El precio debe ser un monto válido',
    });
  }

  const ref = db().collection('plans').doc();
  await ref.set({
    name,
    price: Math.round(body.price),
    features: (body.features ?? [])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .map((f) => f.trim()),
    highlight: body.highlight === true,
    all_branches: body.allBranches === true,
    stripe_product_id: null,
    stripe_price_id: null,
    active: true,
  });
  return toPlan(await ref.get());
});
