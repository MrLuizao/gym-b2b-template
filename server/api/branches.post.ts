import type { Branch } from '#shared/types';

import { db, toBranch } from '../utils/db';
import { requireAdmin, requireStaff } from '../utils/staff-auth';

function toMinutes(value: string): number | null {
  const [h, m] = value.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }
  return h * 60 + m;
}

export default defineEventHandler(async (event): Promise<Branch> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<{
    name?: string;
    address?: string;
    imageUrl?: string;
    maxCapacity?: number;
    openTime?: string;
    closeTime?: string;
    lat?: number | null;
    lng?: number | null;
    status?: Branch['status'];
  }>(event);

  const name = body.name?.trim();
  if (!name || name.length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El nombre de la sede es obligatorio (mín. 3 caracteres)',
    });
  }

  const baseId = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  let id = baseId || 'sede';
  let suffix = 2;
  while ((await db().collection('branches').doc(id).get()).exists) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const openMinutes = body.openTime ? toMinutes(body.openTime) : null;
  const closeMinutes = body.closeTime ? toMinutes(body.closeTime) : null;
  const validHours =
    openMinutes !== null && closeMinutes !== null && closeMinutes > openMinutes;

  const ref = db().collection('branches').doc(id);
  await ref.set({
    name,
    address: body.address?.trim() || 'Sin dirección',
    image_url:
      body.imageUrl?.trim() || `https://picsum.photos/seed/cf-${id}/800/500`,
    max_capacity: Math.max(1, Math.round(body.maxCapacity ?? 100)),
    current_capacity: 0,
    status: body.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    open_minutes: validHours ? openMinutes : 360,
    close_minutes: validHours ? closeMinutes : 1320,
    lat: typeof body.lat === 'number' ? body.lat : null,
    lng: typeof body.lng === 'number' ? body.lng : null,
  });
  return toBranch(await ref.get());
});
