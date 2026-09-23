import type { MemberDetail } from '#shared/types';

import {
  allPlans,
  db,
  toCheckIn,
  toMember,
  toMemberAdmin,
  toPayment,
} from '../../utils/db';
import { requireBranchScope, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<MemberDetail> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const memberSnap = await db().collection('users').doc(id).get();
  if (!memberSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }
  const member = toMember(memberSnap);
  requireBranchScope(staff, member.branchId);

  const [plans, checkInsSnap, paymentsSnap] = await Promise.all([
    allPlans(),
    db()
      .collection('checkins')
      .where('user_id', '==', id)
      .orderBy('check_in_at', 'desc')
      .limit(50)
      .get(),
    db()
      .collection('payments')
      .where('member_id', '==', id)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get(),
  ]);

  /// checkIns son efímeros (TTL del día) — solo muestra actividad de hoy.
  const checkIns = checkInsSnap.docs.map(toCheckIn);
  const payments = paymentsSnap.docs.map(toPayment);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return {
    member: toMemberAdmin(member, plans),
    checkIns,
    payments,
    stats: {
      totalCheckIns: checkIns.filter((c) => c.granted).length,
      monthCheckIns: checkIns.filter(
        (c) => c.granted && c.checkInAt >= monthStart.getTime(),
      ).length,
    },
  };
});
