import { Timestamp } from 'firebase-admin/firestore';

import type { PaymentsReport } from '#shared/types';

import { allPlans, db, toPayment } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<PaymentsReport> => {
  const staff = await requireStaff(event);
  const query = getQuery(event);

  const from = typeof query.from === 'string' ? Number(query.from) : null;
  const to = typeof query.to === 'string' ? Number(query.to) : null;
  /// Staff con sede fija: siempre su sede, ignore el query param.
  const branchId =
    staff.role !== 'ADMIN'
      ? staff.branchId
      : typeof query.branchId === 'string' && query.branchId !== 'todas'
        ? query.branchId
        : null;

  let ref = db()
    .collection('payments')
    .orderBy('created_at', 'desc') as FirebaseFirestore.Query;
  if (branchId) ref = ref.where('branch_id', '==', branchId);
  if (from !== null) ref = ref.where('created_at', '>=', Timestamp.fromMillis(from));
  if (to !== null) ref = ref.where('created_at', '<=', Timestamp.fromMillis(to));

  const snap = await ref.limit(500).get();
  const raw = snap.docs.map(toPayment);

  const memberIds = [...new Set(raw.map((p) => p.memberId))];
  const memberSnaps = await Promise.all(
    memberIds.map((id) => db().collection('users').doc(id).get()),
  );
  const members = new Map(memberSnaps.map((s) => [s.id, s.data() ?? {}]));
  const payments = raw.map((p) => ({
    ...p,
    memberNumber: p.memberNumber ?? (members.get(p.memberId)?.member_number as string) ?? null,
    memberPhotoUrl: (members.get(p.memberId)?.photo_url as string) ?? null,
  }));

  const approved = payments.filter((p) => p.status === 'APPROVED');
  const declined = payments.filter((p) => p.status === 'DECLINED');

  const plans = await allPlans();
  const byPlanMap = new Map<string, { count: number; amount: number }>();
  for (const p of approved) {
    const entry = byPlanMap.get(p.planId) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += p.amount;
    byPlanMap.set(p.planId, entry);
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
        .map(([planId, v]) => ({
          planId,
          plan: plans.find((p) => p.id === planId)?.name ?? planId,
          count: v.count,
          amount: v.amount,
        }))
        .sort((a, b) => b.amount - a.amount),
    },
  };
});
