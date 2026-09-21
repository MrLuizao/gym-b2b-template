import type { Branch } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event): Promise<Branch> => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const branch = db.branches.find((b) => b.id === id);
  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: 'Sede no encontrada' });
  }

  const body = await readBody<Partial<Branch>>(event);

  if (typeof body.name === 'string' && body.name.trim().length >= 3) {
    branch.name = body.name.trim();
  }
  if (typeof body.address === 'string' && body.address.trim()) {
    branch.address = body.address.trim();
  }
  if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    branch.imageUrl = body.imageUrl.trim();
  }
  if (typeof body.maxCapacity === 'number' && body.maxCapacity >= 1) {
    branch.maxCapacity = Math.round(body.maxCapacity);
  }
  if (typeof body.currentCapacity === 'number' && body.currentCapacity >= 0) {
    branch.currentCapacity = Math.min(
      Math.round(body.currentCapacity),
      branch.maxCapacity,
    );
  }
  if (body.lat !== undefined) {
    branch.lat = typeof body.lat === 'number' ? body.lat : null;
  }
  if (body.lng !== undefined) {
    branch.lng = typeof body.lng === 'number' ? body.lng : null;
  }
  if (body.status === 'OPEN' || body.status === 'CLOSED') {
    branch.status = body.status;
  }
  if (typeof body.openMinutes === 'number') {
    branch.openMinutes = Math.min(1439, Math.max(0, Math.round(body.openMinutes)));
  }
  if (typeof body.closeMinutes === 'number') {
    branch.closeMinutes = Math.min(1440, Math.max(1, Math.round(body.closeMinutes)));
  }
  if (branch.closeMinutes <= branch.openMinutes) {
    branch.closeMinutes = Math.min(1440, branch.openMinutes + 60);
  }

  return branch;
});
