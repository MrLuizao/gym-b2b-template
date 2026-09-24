import type { Member } from '#shared/types';

import { allPlans, db, toMember } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(
  async (event): Promise<(Member & { membershipType: string })[]> => {
    const staff = await requireStaff(event);
    const id = getRouterParam(event, 'id') ?? '';

    /// Reservas confirmadas de HOY — los filtros de status/fecha van en
    /// código para no exigir índices compuestos extra.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = fmt.format(new Date());
    const bookings = await db()
      .collection('bookings')
      .where('class_id', '==', id)
      .get();
    /// Reservas viejas sin class_date cuentan en la fecha de su created_at.
    const bookingDate = (b: FirebaseFirestore.DocumentData) =>
      (b.class_date as string) ??
      (b.created_at?.toDate ? fmt.format(b.created_at.toDate()) : today);
    const userIds = [
      ...new Set(
        bookings.docs
          .filter(
            (b) =>
              b.data().status === 'confirmed' &&
              bookingDate(b.data()) === today &&
              /// Staff con sede ve solo las reservas de su sede — una clase
              /// multi-sede tiene contadores por sede.
              (staff.role === 'ADMIN' ||
                !staff.branchId ||
                (b.data().branch_id ?? '') === staff.branchId),
          )
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
