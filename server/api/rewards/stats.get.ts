import { AggregateField } from 'firebase-admin/firestore';

import { db } from '../../utils/db';
import { weekBounds } from '../../utils/loyalty';
import { requireStaff } from '../../utils/staff-auth';

/// GET /api/rewards/stats — KPIs de lealtad: puntos emitidos
/// (`points_earned` acumulado), saldo vivo (`points`) y socios que ya
/// cumplieron su meta esta semana. Gerente/recepción ven solo su sede.
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);

  let users: FirebaseFirestore.Query = db().collection('users');
  if (staff.role !== 'ADMIN') {
    users = users.where('branch_id', '==', staff.branchId ?? '_');
  }

  const { weekKey } = weekBounds();
  const [issued, outstanding, goals] = await Promise.all([
    users
      .aggregate({ total: AggregateField.sum('points_earned') })
      .get(),
    users.aggregate({ total: AggregateField.sum('points') }).get(),
    users
      .where('goal_awarded_week', '==', weekKey)
      .count()
      .get(),
  ]);

  return {
    pointsIssued: Number(issued.data().total ?? 0),
    pointsOutstanding: Number(outstanding.data().total ?? 0),
    goalsThisWeek: goals.data().count,
    weekKey,
  };
});
