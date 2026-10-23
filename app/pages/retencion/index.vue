<script setup lang="ts">
import {
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  Cloud,
  Cpu,
  MessageCircle,
  RefreshCw,
  Search,
  User,
  Users,
} from '@lucide/vue';
import type { Branch, ChurnMember, ChurnMembersResponse } from '#shared/types';

const { session } = useAuth();
const toast = useToast();
const runtimeConfig = useRuntimeConfig();
const isEnabled = computed(() => Boolean(runtimeConfig.public.features?.churnRetention));

const isManager = computed(() => session.value?.role === 'MANAGER');

/// Filtros
const riskFilter = ref<'high' | 'medium' | 'low' | 'all'>('high');
const branchFilter = ref<string>(session.value?.branchId || '');
const searchQuery = ref('');

/// Datos
const members = ref<ChurnMember[]>([]);
const branches = ref<Branch[]>([]);
const loading = ref(false);
const refreshing = ref(false);
const scoringMemberId = ref<string | null>(null);
const actionLoadingId = ref<string | null>(null);

/// KPIs agregados
const kpis = ref({
  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,
  totalActive: 0,
});

const branchOptions = computed(() => {
  const opts = branches.value.map((b) => ({ label: b.name, value: b.id }));
  if (!isManager.value) {
    return [{ label: 'Todas las sedes', value: '' }, ...opts];
  }
  return opts;
});

async function loadBranches() {
  try {
    const data = await $api<Branch[]>('/api/branches');
    branches.value = data || [];
  } catch (err) {
    console.error('Error loading branches:', err);
  }
}

async function loadData() {
  loading.value = true;
  try {
    const res = await $api<ChurnMembersResponse>('/api/analytics/churn-members', {
      query: {
        risk_level: riskFilter.value,
        branch_id: branchFilter.value || undefined,
        limit: 100,
      },
    });
    members.value = res.members || [];
    kpis.value = res.kpis || {
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
      totalActive: 0,
    };
  } catch (error) {
    console.error('Error loading churn members:', error);
    toast.add({
      title: 'Error',
      description: 'No se pudo cargar la lista de socios en riesgo.',
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  refreshing.value = true;
  await loadData();
  refreshing.value = false;
}

const filteredMembers = computed(() => {
  if (!searchQuery.value.trim()) return members.value;
  const q = searchQuery.value.toLowerCase().trim();
  return members.value.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.branch_id.toLowerCase().includes(q),
  );
});

function branchName(id: string): string {
  const b = branches.value.find((item) => item.id === id);
  return b?.name || id;
}

/// Acción: Enviar Push de Reactivación
async function sendPush(member: ChurnMember) {
  actionLoadingId.value = `${member.id}-push`;
  try {
    await $api('/api/analytics/reengage-member', {
      method: 'POST',
      body: {
        memberId: member.id,
        action: 'push',
      },
    });
    toast.add({
      title: 'Push de reactivación enviado',
      description: `Notificación despachada al socio ${member.name}`,
      color: 'success',
    });
  } catch (error: any) {
    console.error('Error sending push:', error);
    toast.add({
      title: 'Error',
      description: error?.message || 'No se pudo enviar la notificación.',
      color: 'error',
    });
  } finally {
    actionLoadingId.value = null;
  }
}

/// Acción: Crear Ticket de Soporte
async function createTicket(member: ChurnMember) {
  actionLoadingId.value = `${member.id}-ticket`;
  try {
    await $api('/api/analytics/reengage-member', {
      method: 'POST',
      body: {
        memberId: member.id,
        action: 'ticket',
      },
    });
    toast.add({
      title: 'Ticket proactivo creado',
      description: `Se abrió conversación con ${member.name} en el panel de Soporte`,
      color: 'success',
    });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    toast.add({
      title: 'Error',
      description: error?.message || 'No se pudo iniciar el ticket de soporte.',
      color: 'error',
    });
  } finally {
    actionLoadingId.value = null;
  }
}

/// Acción: Recalcular Score individual bajo demanda
async function rescore(member: ChurnMember) {
  scoringMemberId.value = member.id;
  try {
    const res = await $api<{
      success: boolean;
      churn_probability: number;
      risk_level: 'low' | 'medium' | 'high';
      top_factors: string[];
      provider: string;
    }>('/api/analytics/churn-score', {
      method: 'POST',
      body: { member_id: member.id },
    });

    member.churn_risk_ml = res.churn_probability;
    member.churn_risk_level = res.risk_level;
    member.churn_top_factors = res.top_factors;
    member.churn_provider = res.provider as any;

    toast.add({
      title: 'Score actualizado',
      description: `Riesgo calculado: ${(res.churn_probability * 100).toFixed(0)}% (${res.risk_level})`,
      color: 'success',
    });
  } catch (err: any) {
    toast.add({
      title: 'Error al recalcular',
      description: err?.message || 'Fallo de inferencia ML',
      color: 'error',
    });
  } finally {
    scoringMemberId.value = null;
  }
}

onMounted(async () => {
  if (isEnabled.value) {
    await loadBranches();
    await loadData();
  }
});
</script>

<template>
  <div v-if="!isEnabled" class="max-w-2xl mx-auto py-16 text-center space-y-4">
    <div class="inline-flex p-4 rounded-2xl bg-surface border border-stroke text-accent">
      <Brain class="w-10 h-10" />
    </div>
    <h1 class="text-2xl font-bold text-text-primary">Módulo de Retención &amp; IA</h1>
    <p class="text-sm text-text-muted leading-relaxed">
      Esta funcionalidad es un módulo avanzado opcional de analítica predictiva de socios y detección de abandono.
      Actualmente no se encuentra habilitado para este gimnasio.
    </p>
    <div class="pt-4">
      <NuxtLink to="/">
        <UButton variant="outline" icon="i-heroicons-arrow-left">Volver al Dashboard</UButton>
      </NuxtLink>
    </div>
  </div>

  <div v-else class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <Brain class="w-6 h-6 text-accent" />
          Retención de Socios &amp; Churn ML
        </h1>
        <p class="text-muted-foreground mt-1 text-sm">
          Detección proactiva de abandono mediante Machine Learning (Scikit-Learn / Vertex AI)
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          :loading="refreshing"
          icon="i-heroicons-arrow-path"
          variant="solid"
          size="sm"
          color="primary"
          @click="refresh"
        >
          Actualizar
        </UButton>
      </div>
    </div>

    <!-- KPIs de Riesgo -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard class="border-l-4 border-l-red-500">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-red-500/10 rounded-xl text-red-500">
            <AlertTriangle class="w-5 h-5" />
          </div>
          <div>
            <div class="text-2xl font-bold text-red-500">{{ kpis.highRisk }}</div>
            <div class="text-xs text-muted-foreground">Riesgo Alto (&gt;65%)</div>
          </div>
        </div>
      </UCard>

      <UCard class="border-l-4 border-l-amber-500">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
            <User class="w-5 h-5" />
          </div>
          <div>
            <div class="text-2xl font-bold text-amber-500">{{ kpis.mediumRisk }}</div>
            <div class="text-xs text-muted-foreground">Riesgo Medio (35–65%)</div>
          </div>
        </div>
      </UCard>

      <UCard class="border-l-4 border-l-green-500">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-green-500/10 rounded-xl text-green-500">
            <CheckCircle2 class="w-5 h-5" />
          </div>
          <div>
            <div class="text-2xl font-bold text-green-500">{{ kpis.lowRisk }}</div>
            <div class="text-xs text-muted-foreground">Riesgo Bajo (&lt;35%)</div>
          </div>
        </div>
      </UCard>

      <UCard class="border-l-4 border-l-blue-500">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-blue-500/10 rounded-xl text-blue-500">
            <Users class="w-5 h-5" />
          </div>
          <div>
            <div class="text-2xl font-bold">{{ kpis.totalActive }}</div>
            <div class="text-xs text-muted-foreground">Socios Activos Evaluados</div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Filtros de Búsqueda -->
    <UCard>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="text-xs font-medium mb-1 block text-muted-foreground">Nivel de Riesgo</label>
          <USelect
            v-model="riskFilter"
            :options="[
              { label: 'Riesgo Alto (Atención urgente)', value: 'high' },
              { label: 'Riesgo Medio (Alerta preventiva)', value: 'medium' },
              { label: 'Riesgo Bajo (Fidelizados)', value: 'low' },
              { label: 'Todos los niveles', value: 'all' },
            ]"
            @change="loadData"
          />
        </div>

        <div>
          <label class="text-xs font-medium mb-1 block text-muted-foreground">Sede</label>
          <USelect
            v-model="branchFilter"
            :options="branchOptions"
            :disabled="isManager && !!session?.branchId"
            @change="loadData"
          />
        </div>

        <div>
          <label class="text-xs font-medium mb-1 block text-muted-foreground">Buscar socio</label>
          <UInput
            v-model="searchQuery"
            placeholder="Nombre, correo o sede..."
            icon="i-heroicons-magnifying-glass"
          />
        </div>
      </div>
    </UCard>

    <!-- Lista de Socios -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-semibold">Socios Identificados</span>
            <UBadge color="neutral" variant="subtle" size="xs">
              {{ filteredMembers.length }}
            </UBadge>
          </div>
          <span class="text-xs text-muted-foreground">
            Ordenado por probabilidad de abandono
          </span>
        </div>
      </template>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-accent" />
      </div>

      <div v-else-if="filteredMembers.length === 0" class="text-center py-12 text-muted-foreground">
        No se encontraron socios en este segmento de riesgo.
      </div>

      <div v-else class="divide-y divide-stroke">
        <div
          v-for="member in filteredMembers"
          :key="member.id"
          class="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface/50 transition px-2 rounded-lg"
        >
          <div class="flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-base">{{ member.name }}</span>
              <span class="text-xs text-muted-foreground">({{ member.email }})</span>
              <UBadge color="neutral" variant="outline" size="xs">
                {{ branchName(member.branch_id) }}
              </UBadge>

              <!-- Pill de Riesgo -->
              <UBadge
                :color="member.churn_risk_level === 'high' ? 'error' : member.churn_risk_level === 'medium' ? 'warning' : 'success'"
                variant="subtle"
                size="xs"
              >
                {{ (member.churn_risk_ml * 100).toFixed(0) }}% Riesgo
              </UBadge>

              <!-- Pill de Motor -->
              <span
                v-if="member.churn_provider"
                class="inline-flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-0.5 rounded border border-stroke"
              >
                <Cloud v-if="member.churn_provider === 'vertex_ai'" class="w-3 h-3 text-warning" />
                <Cpu v-else class="w-3 h-3 text-accent" />
                {{ member.churn_provider === 'vertex_ai' ? 'Vertex AI' : 'Scikit-Learn' }}
              </span>
            </div>

            <!-- Métricas operativas -->
            <div class="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5 font-medium" :class="member.days_since_last_visit >= 10 ? 'text-red-500' : ''">
                <ArrowDown class="w-3.5 h-3.5" />
                Sin asistir: {{ member.days_since_last_visit }} días
              </span>
              <span class="flex items-center gap-1.5">
                <BarChart3 class="w-3.5 h-3.5" />
                Frecuencia: {{ member.avg_visits_per_week_last_4.toFixed(1) }} visitas/sem
              </span>
              <span class="flex items-center gap-1.5">
                <User class="w-3.5 h-3.5" />
                Puntos: {{ member.points }} pts
              </span>
            </div>

            <!-- Factores explicativos de IA -->
            <div v-if="member.churn_top_factors?.length" class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-[11px] text-muted-foreground">Causas probables:</span>
              <span
                v-for="factor in member.churn_top_factors"
                :key="factor"
                class="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-medium"
              >
                {{ factor }}
              </span>
            </div>
          </div>

          <!-- Acciones de Re-engagement -->
          <div class="flex items-center gap-2 self-end lg:self-center shrink-0">
            <UButton
              size="xs"
              variant="outline"
              icon="i-heroicons-arrow-path"
              :loading="scoringMemberId === member.id"
              title="Recalcular con el modelo ML"
              @click="rescore(member)"
            >
              Recalcular
            </UButton>

            <UButton
              size="xs"
              variant="subtle"
              color="primary"
              icon="i-heroicons-bell"
              :loading="actionLoadingId === `${member.id}-push`"
              @click="sendPush(member)"
            >
              Push
            </UButton>

            <UButton
              size="xs"
              variant="subtle"
              color="neutral"
              icon="i-heroicons-chat-bubble-left"
              :loading="actionLoadingId === `${member.id}-ticket`"
              @click="createTicket(member)"
            >
              Ticket
            </UButton>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
