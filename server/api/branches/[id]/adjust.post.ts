import type { Branch } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler(
  async (event): Promise<Branch | null> => {
    const id = getRouterParam(event, 'id');
    const body = await readBody<{ delta?: number }>(event);
    const db = useMockDb();
    const branch = db.branches.find((b) => b.id === id);
    if (!branch) {
      throw createError({ statusCode: 404, statusMessage: 'Sucursal no encontrada' });
    }
    const delta = Math.trunc(Number(body?.delta ?? 0));
    if (!Number.isFinite(delta) || delta === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Delta inválido' });
    }
    branch.currentCapacity = Math.max(
      0,
      Math.min(branch.maxCapacity, branch.currentCapacity + delta),
    );
    return branch;
  },
);
