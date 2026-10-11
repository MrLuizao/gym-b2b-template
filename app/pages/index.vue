<script setup lang="ts">
import { Activity, Clock3, Flame, Users } from '@lucide/vue';

const {
  branches,
  recentCheckIns,
  traffic,
  kpis: staticKpis,
  pending,
  start,
  stop,
  adjust,
  setCapacity,
  adjusting,
} = useDashboardRealtime();
const { closing } = useCloseDay();
const { session } = useAuth();

/// Todos ven el aforo de todas las sedes; editarlo es admin (cualquiera)
/// o gerente de la sede — recepcionista es solo lectura.
function canAdjust(branchId: string): boolean {
  const role = session.value?.role;
  if (role === 'ADMIN') return true;
  return role === 'MANAGER' && branchId === session.value?.branchId;
}

onMounted(() => start());
onBeforeUnmount(() => stop());

const trafficValues = computed(() =>
  traffic.value.map((point) => point.value),
);

function sliceSpark(values: number[], offset: number): number[] {
  if (values.length < 6) return values;
  return values.slice(offset, offset + 9);
}

/// membersToday se calcula en vivo desde el listener de check-ins
const membersToday = computed(() =>
  recentCheckIns.value.filter((c) => c.granted).length,
);

/// Aforo promedio calculado en vivo desde branches
const avgOccupancy = computed(() => {
  if (branches.value.length === 0) return 0;
  const sum = branches.value.reduce(
    (acc, b) => acc + b.currentCapacity / Math.max(1, b.maxCapacity),
    0,
  );
  return Math.round((sum / branches.value.length) * 100);
});

/// Sede más concurrida en vivo
const busiestBranch = computed(() => {
  if (branches.value.length === 0) return '—';
  const sorted = [...branches.value].sort(
    (a, b) =>
      b.currentCapacity / Math.max(1, b.maxCapacity) -
      a.currentCapacity / Math.max(1, a.maxCapacity),
  );
  return sorted[0]?.name ?? '—';
});

const kpis = computed(() => {
  const values = trafficValues.value;
  return [
    {
      label: 'Socios hoy',
      value: String(membersToday.value),
      trend: staticKpis.value?.trends.membersToday ?? 0,
      spark: sliceSpark(values, 0),
      icon: Users,
    },
    {
      label: 'Aforo promedio',
      value: `${avgOccupancy.value}%`,
      trend: staticKpis.value?.trends.avgOccupancy ?? 0,
      spark: sliceSpark(values, 1),
      icon: Activity,
    },
    {
      label: 'Sede más concurrida',
      value: busiestBranch.value,
      trend: staticKpis.value?.trends.busiestBranch ?? 0,
      spark: sliceSpark(values, 2),
      icon: Flame,
    },
    {
      label: 'Hora pico estimada',
      value: staticKpis.value?.peakHour ?? '—',
      trend: staticKpis.value?.trends.peakHour ?? 0,
      spark: sliceSpark(values, 3),
      icon: Clock3,
    },
  ];
});
</script>

<template>
  <div class="space-y-6">
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <template v-if="pending && branches.length === 0">
        <div
          v-for="i in 4"
          :key="i"
          class="animate-pulse rounded-2xl border border-stroke bg-surface p-5"
        >
          <div class="flex items-start justify-between">
            <div class="h-3 w-20 rounded bg-white/5" />
            <div class="h-8 w-8 rounded-xl bg-white/5" />
          </div>
          <div class="mt-4 h-8 w-16 rounded bg-white/5" />
          <div class="mt-3 h-6 w-full rounded bg-white/5" />
        </div>
      </template>
      <StatCard
        v-for="kpi in kpis"
        v-else
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :trend="kpi.trend"
        :spark="kpi.spark"
        :icon="kpi.icon"
      />
    </section>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-black uppercase tracking-widest text-text-muted">
          Aforo en vivo por sucursal
        </h2>
        <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Tiempo real
        </span>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="pending && branches.length === 0">
          <div
            v-for="i in 4"
            :key="i"
            class="animate-pulse rounded-2xl border border-stroke bg-surface p-5"
          >
            <div class="flex items-start justify-between">
              <div class="space-y-2">
                <div class="h-4 w-24 rounded bg-white/5" />
                <div class="h-3 w-32 rounded bg-white/5" />
              </div>
              <div class="h-5 w-14 rounded-full bg-white/5" />
            </div>
            <div class="mt-4 h-7 w-16 rounded bg-white/5" />
            <div class="mt-2 h-2 rounded-full bg-white/5" />
            <div class="mt-4 flex gap-2">
              <div class="h-8 w-8 rounded-lg bg-white/5" />
              <div class="h-8 w-8 rounded-lg bg-white/5" />
            </div>
          </div>
        </template>
        <BranchCard
          v-for="branch in branches"
          v-else
          :key="branch.id"
          :branch="branch"
          :can-adjust="canAdjust(branch.id)"
          :busy="adjusting.includes(branch.id)"
          :closing="closing.includes(branch.id)"
          @adjust="(delta: number) => adjust(branch.id, delta)"
          @set="(value: number) => setCapacity(branch.id, value)"
        />
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-black tracking-tight text-text-primary">
            Curva de afluencia
          </h2>
          <p class="mt-0.5 text-[11px] font-medium text-text-dim">
            Check-ins por hora · día en curso
          </p>
        </div>
      </div>
      <div class="mt-4">
        <TrafficChart v-if="traffic.length" :traffic="traffic" />
        <div v-else class="h-64 animate-pulse rounded-xl bg-base" />
      </div>
    </section>
  </div>
</template>
