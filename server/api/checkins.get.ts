import type { CheckInRecord } from '#shared/types';

import { db, toCheckIn } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<CheckInRecord[]> => {
  const staff = await requireStaff(event);
  const query = getQuery(event);
  let branchId = typeof query.branchId === 'string' ? query.branchId : null;
  const limit = Math.min(200, Math.max(1, Number(query.limit ?? 8)));

  /// Staff con sede fija solo ve sus check-ins.
  if (staff.role !== 'ADMIN') branchId = staff.branchId;

  let ref = db()
    .collection('checkins')
    .orderBy('check_in_at', 'desc') as FirebaseFirestore.Query;
  if (branchId) ref = ref.where('branch_id', '==', branchId);
  const snap = await ref.limit(limit).get();
  return snap.docs.map(toCheckIn);
});
