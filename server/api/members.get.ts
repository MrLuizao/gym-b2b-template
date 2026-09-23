import type { MemberAdmin } from '#shared/types';

import { allPlans, db, toMember, toMemberAdmin } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<MemberAdmin[]> => {
  const staff = await requireStaff(event);
  let ref = db().collection('users') as FirebaseFirestore.Query;
  /// Staff sin sede global solo ve socios de su sucursal.
  if (staff.role !== 'ADMIN' && staff.branchId) {
    ref = ref.where('branch_id', '==', staff.branchId);
  }
  const [snap, plans] = await Promise.all([ref.get(), allPlans()]);
  return snap.docs.map((d) => toMemberAdmin(toMember(d), plans));
});
