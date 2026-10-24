<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock3,
  DollarSign,
  Flame,
  Sparkles,
  User,
  Users,
} from '@lucide/vue';

const {
  branches,
  recentCheckIns,
  traffic,
  branchTraffic,
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
const runtimeConfig = useRuntimeConfig();

/// Acceso a IA y configuración
const isAiEnabled = computed(
  () => Boolean(runtimeConfig.public.features?.churnRetention),
);
const canViewAi = computed(
  () => session.value?.role === 'ADMIN' || session.value?.role === 'MANAGER',
);

const aiKpis = ref({
  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,
  totalActive: 0,
  savedRevenue30d: 0,
  recoveredMembers30d: 0,
});
const aiTopMembers = ref<any[]>([]);
const aiLoading = ref(true);

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? branchId;
}

async function loadAiData(): Promise<void> {
  if (!isAiEnabled.value || !canViewAi.value) return;
  aiLoading.value = true;
  try {
    const res = await $api<any>('/api/analytics/churn-members', {
      query: { risk_level: 'all', limit: 6 },
    });
    if (res.kpis) {
      aiKpis.value = res.kpis;
    }
    if (res.members) {
      aiTopMembers.value = res.members
        .filter((m: any) => m.churn_risk_level === 'high' || m.combined_risk >= 0.5)
        .slice(0, 3);
    }
  } catch (err) {
    console.error('Error cargando métricas IA en Dashboard:', err);
  } finally {
    aiLoading.value = false;
  }
}

/// Todos ven el aforo de todas las sedes; editarlo es admin (cualquiera)
/// o gerente de la sede — recepcionista es solo lectura.
function canAdjust(branchId: string): boolean {
  const role = session.value?.role;
  if (role === 'ADMIN') return true;
  return role === 'MANAGER' && branchId === session.value?.branchId;
}

onMounted(() => {
  start();
  void loadAiData();
});
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
/// Si hay más de 4 sedes, se distribuyen en filas de 3 columnas;
/// si son 4 o menos, se muestran hasta en 4 columnas.
const branchesGridClass = computed(() =>
  branches.value.length > 4
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
);
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

      <div class="grid gap-4" :class="branchesGridClass">
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
          :traffic="branchTraffic[branch.id]"
          :can-adjust="canAdjust(branch.id)"
          :busy="adjusting.includes(branch.id)"
          :closing="closing.includes(branch.id)"
          @adjust="(delta: number) => adjust(branch.id, delta)"
          @set="(value: number) => setCapacity(branch.id, value)"
        />
      </div>
    </section>

    <!-- Bloque de Métricas IA · Diagnóstico de Retención y Salud de Socios -->
    <section v-if="isAiEnabled && canViewAi" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Brain class="h-4 w-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-black uppercase tracking-widest text-text-muted">
                Diagnóstico de Retención IA
              </h2>
              <span class="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-black text-accent">
                Modelo ML + Gemini
              </span>
            </div>
          </div>
        </div>

        <NuxtLink
          to="/retencion"
          class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke bg-surface px-4 py-1.5 text-[11px] font-bold text-text-muted transition hover:border-accent hover:text-text-primary"
        >
          <span>Ir a IA Reportes</span>
          <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </div>

      <!-- Tarjetas de Métricas IA -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <!-- Ingresos Salvados -->
        <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition hover:border-emerald-500/50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="rounded-xl bg-emerald-500/15 p-2 text-emerald-400">
                <DollarSign class="h-4 w-4" />
              </div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                Ingresos Salvados
              </p>
            </div>
            <span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-400">
              30 DÍAS
            </span>
          </div>
          <p class="mt-3 text-2xl font-black text-emerald-400">
            {{ formatMoney(aiKpis.savedRevenue30d) }}
          </p>
          <p class="mt-1 text-[11px] font-semibold text-text-dim">
            {{ aiKpis.recoveredMembers30d }} socios recuperados
          </p>
        </div>

        <!-- Riesgo Alto -->
        <div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 transition hover:border-red-500/50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="rounded-xl bg-red-500/15 p-2 text-red-400">
                <AlertTriangle class="h-4 w-4" />
              </div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                Riesgo Alto
              </p>
            </div>
            <span class="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-black text-red-400">
              URGENTE
            </span>
          </div>
          <p class="mt-3 text-2xl font-black text-red-400">
            {{ aiKpis.highRisk }}
          </p>
          <p class="mt-1 text-[11px] font-semibold text-text-dim">
            &gt;65% prob. de deserción
          </p>
        </div>

        <!-- Riesgo Medio -->
        <div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 transition hover:border-amber-500/50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="rounded-xl bg-amber-500/15 p-2 text-amber-400">
                <User class="h-4 w-4" />
              </div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                Riesgo Medio
              </p>
            </div>
            <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black text-amber-400">
              ALERTA
            </span>
          </div>
          <p class="mt-3 text-2xl font-black text-amber-400">
            {{ aiKpis.mediumRisk }}
          </p>
          <p class="mt-1 text-[11px] font-semibold text-text-dim">
            35–65% asistencia a la baja
          </p>
        </div>

        <!-- Tasa de Retención / Fidelizados -->
        <div class="rounded-2xl border border-stroke bg-surface p-4 transition hover:border-accent/40">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="rounded-xl bg-accent/15 p-2 text-accent">
                <CheckCircle2 class="h-4 w-4" />
              </div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                Fidelizados
              </p>
            </div>
            <span class="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-black text-accent">
              SALUDABLE
            </span>
          </div>
          <p class="mt-3 text-2xl font-black text-text-primary">
            {{ aiKpis.lowRisk }}
            <span class="text-xs font-bold text-text-dim">/ {{ aiKpis.totalActive }}</span>
          </p>
          <p class="mt-1 text-[11px] font-semibold text-text-dim">
            {{ ((aiKpis.lowRisk / Math.max(1, aiKpis.totalActive)) * 100).toFixed(0) }}% retención estable
          </p>
        </div>
      </div>

      <!-- Ticker de Atención Rápida con Socios en Mayor Riesgo -->
      <div v-if="aiTopMembers.length" class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <div class="flex items-center justify-between border-b border-stroke px-5 py-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-black uppercase tracking-wider text-text-primary">
              Atención recomendada por IA
            </span>
            <span class="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-400">
              {{ aiKpis.highRisk }} requieren contacto
            </span>
          </div>
          <span class="text-[11px] font-medium text-text-dim">
            Jugadas contextuales sugeridas
          </span>
        </div>

        <div class="divide-y divide-stroke">
          <div
            v-for="m in aiTopMembers"
            :key="m.id"
            class="flex flex-col gap-3 p-4 transition hover:bg-base/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-xs font-black text-red-400">
                {{ (m.combined_risk * 100).toFixed(0) }}%
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink :to="`/socios/${m.id}`" class="text-xs font-black text-text-primary transition hover:text-accent">
                    {{ m.name }}
                  </NuxtLink>
                  <span class="rounded-full border border-stroke bg-base px-2 py-0.5 text-[9px] font-bold text-text-muted">
                    {{ branchName(m.branch_id) }}
                  </span>
                  <span
                    v-if="m.days_since_last_visit >= 7"
                    class="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400"
                  >
                    {{ m.days_since_last_visit }}d sin asistir
                  </span>
                </div>
                <p class="mt-0.5 text-[11px] text-text-dim">
                  {{ m.churn_top_factors?.[0] || 'Patrón de baja asistencia detectado por el modelo' }}
                </p>
              </div>
            </div>

            <NuxtLink
              to="/retencion"
              class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
            >
              <Sparkles class="h-3.5 w-3.5" />
              <span>Ejecutar Jugada</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
