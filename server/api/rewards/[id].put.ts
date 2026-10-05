import type { Reward } from '#shared/types';

import { db, toMs } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

const VALID_ICONS = ['cup', 'users', 'dumbbell', 'calendar', 'shirt', 'gift'];

/// PUT /api/rewards/:id — edita nombre/costo/icono/activo (solo admin).
export default defineEventHandler(async (event): Promise<Reward> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const id = getRouterParam(event, 'id') ?? '';
  const ref = db().collection('rewards').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Recompensa no encontrada' });
  }

  const body = await readBody<{
    name?: string;
    description?: string;
    pointsCost?: number;
    icon?: string;
    active?: boolean;
  }>(event);

  const patch: Record<string, unknown> = {};
  if (typeof body?.name === 'string' && body.name.trim().length >= 3) {
    patch.name = body.name.trim();
  }
  if (typeof body?.description === 'string') {
    patch.description = body.description.trim();
  }
  if (body?.pointsCost !== undefined) {
    const cost = Math.round(Number(body.pointsCost));
    if (!Number.isFinite(cost) || cost <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'El costo en puntos debe ser mayor a 0',
      });
    }
    patch.points_cost = cost;
  }
  if (body?.icon !== undefined && VALID_ICONS.includes(body.icon)) {
    patch.icon = body.icon;
  }
  if (body?.active !== undefined) {
    patch.active = body.active === true;
  }
  if (Object.keys(patch).length) await ref.update(patch);

  const d = (await ref.get()).data() ?? {};
  return {
    id,
    name: String(d.name ?? ''),
    description: String(d.description ?? ''),
    pointsCost: Number(d.points_cost ?? 0),
    icon: String(d.icon ?? 'gift'),
    active: d.active === true,
    createdAt: toMs(d.created_at) ?? 0,
  };
});
