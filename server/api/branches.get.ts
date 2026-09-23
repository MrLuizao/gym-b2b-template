import type { Branch } from '#shared/types';

import { db, toBranch } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Branch[]> => {
  await requireStaff(event);
  const snap = await db().collection('branches').get();
  return snap.docs.map(toBranch);
});
