import type { ClassSchedule } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler((event): ClassSchedule[] => {
  const db = useMockDb();
  const query = getQuery(event);
  const branchId = typeof query.branchId === 'string' ? query.branchId : null;
  const list = branchId
    ? db.classes.filter((c) => c.branchIds.includes(branchId))
    : db.classes;
  return [...list].sort((a, b) => a.startMinutes - b.startMinutes);
});
