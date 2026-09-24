import { Timestamp } from 'firebase-admin/firestore';

import type { DashboardResponse, TrafficPoint } from '#shared/types';

import { db, toBranch, toCheckIn } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

const TZ = 'America/Mexico_City';

function localNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

export default defineEventHandler(
  async (event): Promise<DashboardResponse> => {
    const staff = await requireStaff(event);

    const local = localNow();
    const startOfDayLocal = new Date(local);
    startOfDayLocal.setHours(0, 0, 0, 0);
    const delta = local.getTime() - startOfDayLocal.getTime();
    const startOfDay = Timestamp.fromMillis(Date.now() - delta);

    /// Staff con sede fija: KPIs/tráfico scopeados a su sucursal, pero
    /// las cards de aforo muestran TODAS las sedes (solo lectura para
    /// quien no puede editarlas).
    const branchId = staff.role === 'ADMIN' ? null : staff.branchId;

    const branchesSnap = await db().collection('branches').get();
    const allBranches = branchesSnap.docs.map(toBranch);
    const branches = branchId
      ? allBranches.filter((b) => b.id === branchId)
      : allBranches;

    let checkinsRef = db()
      .collection('checkins')
      .where('check_in_at', '>=', startOfDay)
      .orderBy('check_in_at', 'desc') as FirebaseFirestore.Query;
    if (branchId) checkinsRef = checkinsRef.where('branch_id', '==', branchId);
    const checkinsSnap = await checkinsRef.get();
    const todayCheckIns = checkinsSnap.docs.map(toCheckIn);

    /// Tráfico del día: del forecast de la sede (o agregado de todas).
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

    return {
      kpis: {
        membersToday: todayCheckIns.filter((c) => c.granted).length,
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
      branches: allBranches,
      traffic,
      recentCheckIns: todayCheckIns.slice(0, 8),
    };
  },
);
