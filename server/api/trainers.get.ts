import type { Trainer } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler((event): Trainer[] => {
  const db = useMockDb();
  const query = getQuery(event);
  const branchId = typeof query.branchId === 'string' ? query.branchId : null;
  const list = branchId
    ? db.trainers.filter((t) => t.branchIds.includes(branchId))
    : db.trainers;
  return list;
});
