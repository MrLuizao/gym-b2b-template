import type { CheckInsReport } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event): CheckInsReport => {
  const db = useMockDb();
  const query = getQuery(event);

  const from = typeof query.from === 'string' ? Number(query.from) : null;
  const to = typeof query.to === 'string' ? Number(query.to) : null;
  const branchId = typeof query.branchId === 'string' ? query.branchId : null;

  const checkIns = db.checkIns
    .filter(
      (c) =>
        (from === null || c.checkInAt >= from) &&
        (to === null || c.checkInAt <= to) &&
        (!branchId || branchId === 'todas' || c.branchId === branchId),
    )
    .sort((a, b) => b.checkInAt - a.checkInAt);

  const byBranchMap = new Map<string, number>();
  for (const c of checkIns) {
    byBranchMap.set(c.branchId, (byBranchMap.get(c.branchId) ?? 0) + 1);
  }

  return {
    checkIns,
    stats: {
      total: checkIns.length,
      granted: checkIns.filter((c) => c.granted).length,
      denied: checkIns.filter((c) => !c.granted).length,
      uniqueMembers: new Set(checkIns.map((c) => c.userId)).size,
      byBranch: [...byBranchMap.entries()]
        .map(([id, count]) => ({ branchId: id, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
});
