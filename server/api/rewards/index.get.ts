import type { Reward } from '#shared/types';

import { db, toMs } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

/// GET /api/rewards — catálogo completo (staff; el admin lo edita).
export default defineEventHandler(async (event): Promise<Reward[]> => {
  await requireStaff(event);
  const snap = await db().collection('rewards').get();
  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: String(d.name ?? ''),
        description: String(d.description ?? ''),
        pointsCost: Number(d.points_cost ?? 0),
        icon: String(d.icon ?? 'gift'),
        active: d.active === true,
        createdAt: toMs(d.created_at) ?? 0,
      } satisfies Reward;
    })
    .sort((a, b) => a.pointsCost - b.pointsCost);
});
