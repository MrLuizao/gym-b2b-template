import type { Branch } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler((event): Branch[] => {
  const db = useMockDb();
  const query = getQuery(event);
  const brandId = typeof query.brandId === 'string' ? query.brandId : 'capital_fitness';
  return db.branches.filter((b) => b.brandId === brandId);
});
