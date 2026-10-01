import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Branch, CheckInRecord, TrafficPoint } from '#shared/types';

export interface DashboardKpis {
  membersToday: number;
  avgOccupancy: number;
  busiestBranch: string;
  peakHour: string;
  trends: {
    membersToday: number;
    avgOccupancy: number;
    busiestBranch: number;
    peakHour: number;
  };
}

/// Dashboard con listeners realtime de Firestore — sin polling.
/// `branches` y `recentCheckIns` se actualizan instantáneamente;
/// los KPIs históricos (trends, traffic) se cargan una vez al montar.
export function useDashboardRealtime() {
  const { db } = useFirebase();

  const branches = ref<Branch[]>([]);
  const recentCheckIns = ref<CheckInRecord[]>([]);
  const traffic = ref<TrafficPoint[]>([]);
  const kpis = ref<DashboardKpis | null>(null);
  const pending = ref(true);
  const error = ref<string | null>(null);

  const unsubs: Unsubscribe[] = [];

  /// Carga única de KPIs históricos y curva de tráfico (no cambian en
  /// tiempo real — se recalculan al cierre de día).
  async function loadStatic(): Promise<void> {
    try {
      const data = await $api<{
        kpis: DashboardKpis;
        traffic: TrafficPoint[];
      }>('/api/dashboard/static');
      kpis.value = data.kpis;
      traffic.value = data.traffic;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Error de red';
    }
  }

  function start(): void {
    if (!db) {
      error.value = 'Firebase no configurado';
      pending.value = false;
      return;
    }

    /// 1. Listener de branches — aforo en vivo
    const branchesRef = collection(db, 'branches');
    unsubs.push(
      onSnapshot(
        branchesRef,
        (snap) => {
          branches.value = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              brandId: String(data.brand_id ?? ''),
              name: String(data.name ?? ''),
              maxCapacity: Number(data.max_capacity ?? 0),
              currentCapacity: Number(data.current_capacity ?? 0),
              status: deriveStatus(data) as 'OPEN' | 'CLOSED',
              imageUrl: String(data.image_url ?? ''),
              address: String(data.address ?? ''),
              openMinutes: Number(data.open_minutes ?? 0),
              closeMinutes: Number(data.close_minutes ?? 1440),
              lat: data.lat != null ? Number(data.lat) : null,
              lng: data.lng != null ? Number(data.lng) : null,
            } satisfies Branch;
          });
          pending.value = false;
        },
        (err) => {
          error.value = err.message;
          pending.value = false;
        },
      ),
    );

    /// 2. Listener de check-ins recientes (últimos 10, hoy)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const checkinsRef = query(
      collection(db, 'checkins'),
      where('check_in_at', '>=', Timestamp.fromDate(startOfDay)),
      orderBy('check_in_at', 'desc'),
      limit(10),
    );
    unsubs.push(
      onSnapshot(
        checkinsRef,
        (snap) => {
          recentCheckIns.value = snap.docs.map((d) => {
            const data = d.data();
            const checkInAt = data.check_in_at as Timestamp | undefined;
            const checkOutAt = data.checked_out_at as Timestamp | undefined;
            return {
              id: d.id,
              userId: String(data.user_id ?? ''),
              branchId: String(data.branch_id ?? ''),
              memberName: String(data.member_name ?? ''),
              membershipType: String(data.membership_type ?? ''),
              method: (data.method ?? 'qr') as 'qr' | 'usb' | 'manual' | 'partner',
              granted: data.granted === true,
              reason: data.reason as string | undefined,
              checkInAt: checkInAt?.toMillis() ?? Date.now(),
              checkedOut: data.checked_out === true,
              checkedOutAt: checkOutAt?.toMillis(),
              provider: (data.provider ?? 'member') as 'member' | 'wellhub' | 'totalpass',
              externalId: data.external_id as string | undefined,
            } satisfies CheckInRecord;
          });
        },
        (err) => {
          console.error('checkins listener error:', err);
        },
      ),
    );

    /// 3. Carga estática (KPIs + traffic) — una sola vez
    void loadStatic();
  }

  function stop(): void {
    unsubs.forEach((u) => u());
    unsubs.length = 0;
  }

  /// Ajuste de aforo — sigue por API (las rules no permiten write directo)
  const adjusting = ref<string[]>([]);

  async function sendAdjust(
    branchId: string,
    body: { delta?: number; value?: number },
  ): Promise<void> {
    if (adjusting.value.includes(branchId)) return;
    adjusting.value = [...adjusting.value, branchId];
    try {
      await $api<Branch>(`/api/branches/${branchId}/adjust`, {
        method: 'POST',
        body,
      });
      // El listener de branches actualiza el valor automáticamente
    } finally {
      adjusting.value = adjusting.value.filter((id) => id !== branchId);
    }
  }

  async function adjust(branchId: string, delta: number): Promise<void> {
    await sendAdjust(branchId, { delta });
  }

  async function setCapacity(branchId: string, value: number): Promise<void> {
    await sendAdjust(branchId, { value });
  }

  onScopeDispose(stop);

  return {
    branches,
    recentCheckIns,
    traffic,
    kpis,
    pending,
    error,
    start,
    stop,
    adjust,
    setCapacity,
    adjusting,
  };
}

/// Deriva el status de la sede según horario actual (CDMX)
function deriveStatus(
  data: Record<string, unknown>,
): 'OPEN' | 'CLOSED' | 'MAINTENANCE' {
  if (data.status === 'MAINTENANCE') return 'MAINTENANCE';
  const now = new Date();
  const cdmx = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const mins = cdmx.getHours() * 60 + cdmx.getMinutes();
  const open = Number(data.open_minutes ?? 0);
  const close = Number(data.close_minutes ?? 1440);
  return mins >= open && mins < close ? 'OPEN' : 'CLOSED';
}
