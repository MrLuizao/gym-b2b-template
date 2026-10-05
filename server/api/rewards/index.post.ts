import { FieldValue } from 'firebase-admin/firestore';

import type { Reward } from '#shared/types';

import { db } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

const VALID_ICONS = ['cup', 'users', 'dumbbell', 'calendar', 'shirt', 'gift'];

/// POST /api/rewards — crea recompensa (catálogo global, solo admin).
export default defineEventHandler(async (event): Promise<Reward> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<{
    name?: string;
    description?: string;
    pointsCost?: number;
    icon?: string;
  }>(event);

  const name = body?.name?.trim() ?? '';
  if (name.length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El nombre es obligatorio (mín. 3 caracteres)',
    });
  }
  const cost = Math.round(Number(body?.pointsCost));
  if (!Number.isFinite(cost) || cost <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El costo en puntos debe ser mayor a 0',
    });
  }

  const icon = VALID_ICONS.includes(body?.icon ?? '') ? body!.icon! : 'gift';
  const ref = db().collection('rewards').doc();
  await ref.set({
    name,
    description: body?.description?.trim() ?? '',
    points_cost: cost,
    icon,
    image_url: '',
    active: true,
    created_at: FieldValue.serverTimestamp(),
  });
  return {
    id: ref.id,
    name,
    description: body?.description?.trim() ?? '',
    pointsCost: cost,
    icon,
    active: true,
    createdAt: Date.now(),
  };
});
