import type { TrafficPoint } from '#shared/types';

import { db, toBranch } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

const TZ = 'America/Mexico_City';

function localNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

/// KPIs históricos y curva de tráfico — datos que no cambian en tiempo
/// real (se recalculan al cierre de día). El cliente los carga una vez
/// al montar el dashboard; el aforo en vivo viene por listener.
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);

  const branchId = staff.role === 'ADMIN' ? null : staff.branchId;

  const branchesSnap = await db().collection('branches').get();
  const allBranches = branchesSnap.docs.map(toBranch);
  const branches = branchId
    ? allBranches.filter((b) => b.id === branchId)
    : allBranches;

  /// Curva de tráfico del forecast (EMA histórico por weekday)
  const local = localNow();
  const weekday = String(((local.getDay() + 6) % 7) + 1);
  const forecastSnaps = await Promise.all(
    branches.map((b) => db().collection('forecasts').doc(b.id).get()),
  );
  const traffic: TrafficPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const value = forecastSnaps.reduce((sum, s) => {
      const wk = (s.data()?.by_weekday as Record<string, number[]>) ?? {};
      return sum + (wk[weekday]?.[h] ?? 0);
    }, 0);
    traffic.push({ hour: h, value: Math.round(value) });
  }

  /// KPIs calculados sobre el estado actual (snapshot, no realtime)
  const avgOccupancy =
    branches.length > 0
      ? branches.reduce(
          (acc, b) => acc + b.currentCapacity / Math.max(1, b.maxCapacity),
          0,
        ) / branches.length
      : 0;
  const busiest = [...branches].sort(
    (a, b) =>
      b.currentCapacity / Math.max(1, b.maxCapacity) -
      a.currentCapacity / Math.max(1, a.maxCapacity),
  )[0];
  const peak = traffic.reduce(
    (max, p) => (p.value > max.value ? p : max),
    traffic[0] ?? { hour: 19, value: 0 },
  );

  /// membersToday se calcula en el cliente a partir del listener de
  /// checkins — aquí devolvemos 0 como placeholder (el valor real viene
  /// del realtime).
  return {
    kpis: {
      membersToday: 0,
      avgOccupancy: Math.round(avgOccupancy * 100),
      busiestBranch: busiest?.name ?? '—',
      peakHour: `${String(peak.hour).padStart(2, '0')}:00`,
      trends: {
        membersToday: 0,
        avgOccupancy: 0,
        busiestBranch: 0,
        peakHour: 0,
      },
    },
    traffic,
  };
});
