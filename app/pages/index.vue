<script setup lang="ts">
import { Activity, Clock3, Flame, Users } from '@lucide/vue';

const { data, pending, start, stop, adjust } = useDashboard();
const { session } = useAuth();

/// Admin puede ajustar cualquier sede; gerente/recepcionista solo la suya.
function canAdjust(branchId: string): boolean {
  const own = session.value?.branchId;
  return !own || branchId === own;
}

onMounted(() => start());
onBeforeUnmount(() => stop());

const trafficValues = computed(() =>
  data.value?.traffic.map((point) => point.value) ?? [],
);

function sliceSpark(values: number[], offset: number): number[] {
  if (values.length < 6) return values;
  return values.slice(offset, offset + 9);
}

const kpis = computed(() => {
  const kpis = data.value?.kpis;
  const values = trafficValues.value;
  return [
    {
      label: 'Socios hoy',
      value: kpis ? String(kpis.membersToday) : '—',
      trend: kpis?.trends.membersToday ?? 0,
      spark: sliceSpark(values, 0),
      icon: Users,
    },
    {
      label: 'Aforo promedio',
      value: `${kpis?.avgOccupancy ?? 0}%`,
      trend: kpis?.trends.avgOccupancy ?? 0,
      spark: sliceSpark(values, 1),
      icon: Activity,
    },
    {
      label: 'Sede más concurrida',
      value: kpis?.busiestBranch ?? '—',
      trend: kpis?.trends.busiestBranch ?? 0,
      spark: sliceSpark(values, 2),
      icon: Flame,
    },
    {
      label: 'Hora pico estimada',
      value: kpis?.peakHour ?? '—',
      trend: kpis?.trends.peakHour ?? 0,
      spark: sliceSpark(values, 3),
      icon: Clock3,
    },
  ];
});

const branches = computed(() => data.value?.branches ?? []);
</script>

<template>
  <div class="space-y-6">
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        v-for="kpi in kpis"
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
        <BranchCard
          v-for="branch in branches"
          :key="branch.id"
          :branch="branch"
          :can-adjust="canAdjust(branch.id)"
          @adjust="(delta: number) => adjust(branch.id, delta)"
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
        <TrafficChart v-if="data" :traffic="data.traffic" />
        <div v-else class="h-64 animate-pulse rounded-xl bg-base" />
      </div>
    </section>
  </div>
</template>
