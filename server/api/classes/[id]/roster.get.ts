import type { Member } from '#shared/types';

import { allPlans, db, toMember } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(
  async (event): Promise<(Member & { membershipType: string })[]> => {
    await requireStaff(event);
    const id = getRouterParam(event, 'id') ?? '';

    const snap = await db().collection('classes').doc(id).get();
    if (!snap.exists) {
      throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
    }
    const gymClass = snap.data() ?? {};
    const branchIds = (gymClass.branch_ids as string[]) ?? [];
    const booked = Number(gymClass.booked ?? 0);
    if (branchIds.length === 0 || booked === 0) return [];

    /// Sin modelo de reservas aún: muestra socios activos de las sedes
    /// donde se imparte, hasta cubrir el cupo reservado (igual que el mock).
    const [plans, snap2] = await Promise.all([
      allPlans(),
      db()
        .collection('users')
        .where('branch_id', 'in', branchIds.slice(0, 10))
        .where('membership_status', '==', 'ACTIVE')
        .limit(booked)
        .get(),
    ]);
    return snap2.docs.map((d) => {
      const m = toMember(d);
      return {
        ...m,
        membershipType:
          plans.find((p) => p.id === m.membershipPlanId)?.name ?? 'Sin plan',
      };
    });
  },
);
