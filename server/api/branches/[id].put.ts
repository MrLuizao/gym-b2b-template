import type { Branch } from '#shared/types';

import { db, toBranch } from '../../utils/db';
import { requireBranchScope, requireStaff } from '../../utils/staff-auth';

/// Campos que el gerente NO puede tocar en su propia sede.
const MANAGER_BLOCKED = new Set(['maxCapacity', 'currentCapacity']);

export default defineEventHandler(async (event): Promise<Branch> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('branches').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Sede no encontrada' });
  }
  requireBranchScope(staff, id);

  const body = await readBody<Partial<Branch>>(event);

  if (
    staff.role === 'MANAGER' &&
    Object.keys(body ?? {}).some((k) => MANAGER_BLOCKED.has(k))
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Aforo máximo solo lo define el admin',
    });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim().length >= 3) {
    update.name = body.name.trim();
  }
  if (typeof body.address === 'string' && body.address.trim()) {
    update.address = body.address.trim();
  }
  if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    update.image_url = body.imageUrl.trim();
  }
  if (typeof body.maxCapacity === 'number' && body.maxCapacity >= 1) {
    update.max_capacity = Math.round(body.maxCapacity);
  }
  if (typeof body.currentCapacity === 'number' && body.currentCapacity >= 0) {
    update.current_capacity = Math.round(body.currentCapacity);
  }
  if (body.lat !== undefined) {
    update.lat = typeof body.lat === 'number' ? body.lat : null;
  }
  if (body.lng !== undefined) {
    update.lng = typeof body.lng === 'number' ? body.lng : null;
  }
  if (body.status === 'OPEN' || body.status === 'CLOSED') {
    update.status = body.status;
  }
  if (typeof body.openMinutes === 'number') {
    update.open_minutes = Math.min(1439, Math.max(0, Math.round(body.openMinutes)));
  }
  if (typeof body.closeMinutes === 'number') {
    update.close_minutes = Math.min(1440, Math.max(1, Math.round(body.closeMinutes)));
  }

  /// close > open siempre (igual que antes).
  if (update.open_minutes !== undefined || update.close_minutes !== undefined) {
    const cur = (await ref.get()).data() ?? {};
    const open = (update.open_minutes as number) ?? (cur.open_minutes as number);
    const close = (update.close_minutes as number) ?? (cur.close_minutes as number);
    if (close <= open) update.close_minutes = Math.min(1440, open + 60);
  }

  if (Object.keys(update).length > 0) await ref.update(update);
  return toBranch(await ref.get());
});
