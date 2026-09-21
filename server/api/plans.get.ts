import type { MembershipPlan } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler((): MembershipPlan[] => {
  const db = useMockDb();
  return [...db.plans].sort((a, b) => a.priceBs - b.priceBs);
});
