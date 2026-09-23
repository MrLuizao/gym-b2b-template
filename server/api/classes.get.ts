import type { ClassSchedule } from '#shared/types';

import { db, toClass } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<ClassSchedule[]> => {
  await requireStaff(event);
  const query = getQuery(event);
  const branchId = typeof query.branchId === 'string' ? query.branchId : null;
  const ref = db().collection('classes') as FirebaseFirestore.Query;
  const scoped = branchId ? ref.where('branch_ids', 'array-contains', branchId) : ref;
  const snap = await scoped.get();
  return snap.docs
    .map(toClass)
    .sort((a, b) => a.startMinutes - b.startMinutes);
});
