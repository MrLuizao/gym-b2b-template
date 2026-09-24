<script setup lang="ts">
import { Activity, Clock3, Flame, Users } from '@lucide/vue';

const { data, pending, start, stop, adjust, setCapacity, adjusting } =
  useDashboard();
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
        <template v-if="pending && !data">
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
        <TrafficChart v-if="data" :traffic="data.traffic" />
        <div v-else class="h-64 animate-pulse rounded-xl bg-base" />
      </div>
    </section>
  </div>
</template>
