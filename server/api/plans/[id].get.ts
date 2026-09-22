import type { PlanDetail } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event): PlanDetail => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();

  const plan = db.plans.find((p) => p.id === id);
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan no encontrado' });
  }

  const payments = db.payments
    .filter((p) => p.plan === plan.name)
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    plan,
    payments,
    stats: {
      members: db.members.filter((m) => m.membershipType === plan.name).length,
      payments: payments.length,
      revenue: payments
        .filter((p) => p.status === 'APPROVED')
        .reduce((total, p) => total + p.amount, 0),
    },
  };
});
