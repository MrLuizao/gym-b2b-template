import type { DashboardResponse } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler((): DashboardResponse => {
  const db = useMockDb();
  const random = Math.random;

  for (const branch of db.branches) {
    const delta = Math.round((random() - 0.48) * 6);
    branch.currentCapacity = Math.max(
      0,
      Math.min(branch.maxCapacity, branch.currentCapacity + delta),
    );
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const todayCheckIns = db.checkIns.filter((c) => c.checkInAt >= startOfDay.getTime());
  const avgOccupancy =
    db.branches.reduce((acc, b) => acc + b.currentCapacity / b.maxCapacity, 0) /
    db.branches.length;
  const busiest = [...db.branches].sort(
    (a, b) => b.currentCapacity / b.maxCapacity - a.currentCapacity / a.maxCapacity,
  )[0]!;
  const peak = db.traffic.reduce((max, p) => (p.value > max.value ? p : max), db.traffic[0]!);

  return {
    kpis: {
      membersToday: todayCheckIns.filter((c) => c.granted).length,
      avgOccupancy: Math.round(avgOccupancy * 100),
      busiestBranch: busiest.name,
      peakHour: `${String(peak.hour).padStart(2, '0')}:00`,
      trends: {
        membersToday: 8.4,
        avgOccupancy: -2.1,
        busiestBranch: 4.6,
        peakHour: 1.2,
      },
    },
    branches: db.branches,
    traffic: db.traffic,
    recentCheckIns: db.checkIns.slice(0, 8),
  };
});
