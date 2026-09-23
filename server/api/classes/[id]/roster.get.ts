import type { Member } from '#shared/types';

import { allPlans, db, toMember } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(
  async (event): Promise<(Member & { membershipType: string })[]> => {
    await requireStaff(event);
    const id = getRouterParam(event, 'id') ?? '';

    /// Reservas confirmadas — el filtro de status va en código para no
    /// exigir un índice compuesto extra (class_id + status).
    const bookings = await db()
      .collection('bookings')
      .where('class_id', '==', id)
      .get();
    const userIds = [
      ...new Set(
        bookings.docs
          .filter((b) => b.data().status === 'confirmed')
          .map((b) => b.data().user_id as string)
          .filter(Boolean),
      ),
    ];
    if (userIds.length === 0) return [];

    const [plans, memberDocs] = await Promise.all([
      allPlans(),
      Promise.all(userIds.map((uid) => db().collection('users').doc(uid).get())),
    ]);
    return memberDocs
      .filter((d) => d.exists)
      .map((d) => {
        const m = toMember(d);
        return {
          ...m,
          membershipType:
            plans.find((p) => p.id === m.membershipPlanId)?.name ?? 'Sin plan',
        };
      });
  },
);
