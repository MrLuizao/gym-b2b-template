import type { Branch } from '#shared/types';

import { FieldValue, db, toBranch } from '../../../utils/db';
import { requireBranchScope, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Branch> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';
  const body = await readBody<{ delta?: number }>(event);

  const ref = db().collection('branches').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Sucursal no encontrada' });
  }
  requireBranchScope(staff, id);

  const delta = Math.trunc(Number(body?.delta ?? 0));
  if (!Number.isFinite(delta) || delta === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Delta inválido' });
  }
  await ref.update({ current_capacity: FieldValue.increment(delta) });
  return toBranch(await ref.get());
});
