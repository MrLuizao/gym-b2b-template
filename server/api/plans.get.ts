import type { MembershipPlan } from '#shared/types';

import { allPlans } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<MembershipPlan[]> => {
  await requireStaff(event);
  return (await allPlans()).sort((a, b) => a.price - b.price);
});
