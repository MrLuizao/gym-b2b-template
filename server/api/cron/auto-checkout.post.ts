import { useMockDb } from '../../utils/mock-db';

const IDLE_LIMIT_MINUTES = 90;

export default defineEventHandler((event) => {
  const db = useMockDb();
  const cutoff = Date.now() - IDLE_LIMIT_MINUTES * 60_000;

  const stale = db.checkIns.filter(
    (c) => c.granted && !c.checkedOut && c.checkInAt < cutoff,
  );

  const releasedByBranch = new Map<string, number>();
  for (const record of stale) {
    record.checkedOut = true;
    record.checkedOutAt = Date.now();
    releasedByBranch.set(
      record.branchId,
      (releasedByBranch.get(record.branchId) ?? 0) + 1,
    );
  }

  for (const [branchId, count] of releasedByBranch) {
    const branch = db.branches.find((b) => b.id === branchId);
    if (branch) {
      branch.currentCapacity = Math.max(0, branch.currentCapacity - count);
    }
  }

  return {
    released: stale.length,
    minutesIdle: IDLE_LIMIT_MINUTES,
    byBranch: Object.fromEntries(releasedByBranch),
  };
});
