import type { PaymentsReport } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event): PaymentsReport => {
  const db = useMockDb();
  const query = getQuery(event);

  const from = typeof query.from === 'string' ? Number(query.from) : null;
  const to = typeof query.to === 'string' ? Number(query.to) : null;
  const branchId = typeof query.branchId === 'string' ? query.branchId : null;

  const payments = db.payments
    .filter(
      (p) =>
        (from === null || p.createdAt >= from) &&
        (to === null || p.createdAt <= to) &&
        (!branchId || branchId === 'todas' || p.branchId === branchId),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => {
      const member = db.members.find((m) => m.id === p.memberId);
      return {
        ...p,
        memberNumber: member?.memberNumber ?? null,
        memberPhotoUrl: member?.photoUrl ?? null,
      };
    });

  const approved = payments.filter((p) => p.status === 'APPROVED');
  const declined = payments.filter((p) => p.status === 'DECLINED');

  const byPlanMap = new Map<string, { count: number; amount: number }>();
  for (const p of approved) {
    const entry = byPlanMap.get(p.plan) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += p.amount;
    byPlanMap.set(p.plan, entry);
  }

  return {
    payments,
    stats: {
      total: payments.length,
      approved: approved.length,
      declined: declined.length,
      amountApproved: approved.reduce((t, p) => t + p.amount, 0),
      amountDeclined: declined.reduce((t, p) => t + p.amount, 0),
      byPlan: [...byPlanMap.entries()]
        .map(([plan, v]) => ({ plan, count: v.count, amount: v.amount }))
        .sort((a, b) => b.amount - a.amount),
    },
  };
});
