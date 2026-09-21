import type { CheckInRecord } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler((event): CheckInRecord[] => {
  const db = useMockDb();
  const query = getQuery(event);
  const branchId = typeof query.branchId === 'string' ? query.branchId : null;
  const limit = Math.min(50, Math.max(1, Number(query.limit ?? 8)));
  const filtered = branchId
    ? db.checkIns.filter((c) => c.branchId === branchId)
    : db.checkIns;
  return filtered.slice(0, limit);
});
