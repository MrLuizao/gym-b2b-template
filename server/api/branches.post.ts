import type { Branch } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

function toMinutes(value: string): number | null {
  const [h, m] = value.split(':').map(Number);
  if (
    h === undefined ||
    m === undefined ||
    Number.isNaN(h) ||
    Number.isNaN(m)
  ) {
    return null;
  }
  return h * 60 + m;
}

export default defineEventHandler(async (event): Promise<Branch> => {
  const db = useMockDb();
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
  let id = baseId || `sede-${db.branches.length + 1}`;
  let suffix = 2;
  while (db.branches.some((b) => b.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const openMinutes = body.openTime ? toMinutes(body.openTime) : null;
  const closeMinutes = body.closeTime ? toMinutes(body.closeTime) : null;

  const branch: Branch = {
    id,
    brandId: 'capital_fitness',
    name,
    address: body.address?.trim() || 'Sin dirección',
    imageUrl:
      body.imageUrl?.trim() ||
      `https://picsum.photos/seed/cf-${id}/800/500`,
    maxCapacity: Math.max(1, Math.round(body.maxCapacity ?? 100)),
    currentCapacity: 0,
    lat: typeof body.lat === 'number' ? body.lat : null,
    lng: typeof body.lng === 'number' ? body.lng : null,
    status: body.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    openMinutes:
      openMinutes !== null && closeMinutes !== null && closeMinutes > openMinutes
        ? openMinutes
        : 360,
    closeMinutes:
      openMinutes !== null && closeMinutes !== null && closeMinutes > openMinutes
        ? closeMinutes
        : 1320,
  };

  db.branches.push(branch);
  return branch;
});
