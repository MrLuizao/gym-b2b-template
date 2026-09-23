import type { MembershipPlan } from '#shared/types';

import { db, toPlan } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<MembershipPlan> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('plans').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Plan no encontrado' });
  }

  const body = await readBody<Partial<MembershipPlan> & { active?: boolean }>(
    event,
  );
  const update: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim().length >= 3) {
    update.name = body.name.trim();
  }
  if (typeof body.price === 'number' && body.price >= 0) {
    update.price = Math.round(body.price);
  }
  if (Array.isArray(body.features)) {
    update.features = body.features
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .map((f) => f.trim());
  }
  if (typeof body.highlight === 'boolean') update.highlight = body.highlight;
  if (typeof body.allBranches === 'boolean') {
    update.all_branches = body.allBranches;
  }
  if (typeof body.active === 'boolean') update.active = body.active;

  if (Object.keys(update).length > 0) await ref.update(update);
  /// Las referencias son por id — renombrar no toca socios ni pagos.
  return toPlan(await ref.get());
});
