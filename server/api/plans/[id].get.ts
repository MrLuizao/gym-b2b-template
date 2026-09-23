import type { PlanDetail } from '#shared/types';

import { db, toPayment, toPlan } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<PlanDetail> => {
  await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const planSnap = await db().collection('plans').doc(id).get();
  if (!planSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Plan no encontrado' });
  }

  const [paymentsSnap, membersCount] = await Promise.all([
    db()
      .collection('payments')
      .where('plan_id', '==', id)
      .orderBy('created_at', 'desc')
      .limit(100)
      .get(),
    db()
      .collection('users')
      .where('membership_plan_id', '==', id)
      .count()
      .get(),
  ]);

  const payments = paymentsSnap.docs.map(toPayment);
  return {
    plan: toPlan(planSnap),
    payments,
    stats: {
      members: membersCount.data().count,
      payments: payments.length,
      revenue: payments
        .filter((p) => p.status === 'APPROVED')
        .reduce((t, p) => t + p.amount, 0),
    },
  };
});
