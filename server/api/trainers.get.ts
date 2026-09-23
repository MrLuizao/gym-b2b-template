import type { Trainer } from '#shared/types';

import { db, toTrainer } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Trainer[]> => {
  await requireStaff(event);
  const query = getQuery(event);
  const branchId = typeof query.branchId === 'string' ? query.branchId : null;
  const ref = db().collection('trainers') as FirebaseFirestore.Query;
  const scoped = branchId ? ref.where('branch_ids', 'array-contains', branchId) : ref;
  const snap = await scoped.get();
  return snap.docs.map(toTrainer);
});
