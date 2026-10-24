<script setup lang="ts">
import {
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Brain,
  CheckCircle2,
  Cloud,
  Cpu,
  DollarSign,
  Gift,
  Sparkles,
  User,
  Users,
} from '@lucide/vue';
import type {
  Branch,
  ChurnMember,
  ChurnMembersResponse,
  RetentionPlaybookId,
} from '#shared/types';

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

/// Modal de Playbook IA
const playbookModalOpen = ref(false);
const activeMember = ref<ChurnMember | null>(null);
const selectedPlaybook = ref<RetentionPlaybookId>('habit_boost');
const selectedAction = ref<'push' | 'bonus_push' | 'ticket'>('push');
const draftTitle = ref('');
const draftMessage = ref('');
const draftAiPowered = ref(false);
const generatingPreview = ref(false);
const executingPlaybook = ref(false);

/// KPIs agregados
const kpis = ref({
  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,
  totalActive: 0,
  savedRevenue30d: 0,
  recoveredMembers30d: 0,
});

const PLAYBOOK_META: Record<
  RetentionPlaybookId,
  {
    label: string;
    shortDesc: string;
    defaultAction: 'push' | 'bonus_push' | 'ticket';
    badgeClass: string;
  }
> = {
  streak_rescue: {
    label: '🔥 Rescate de Racha (+25 pts)',
    shortDesc: 'Otorga bono motivacional de +25 pts y recuerda saldo canjeable',
    defaultAction: 'bonus_push',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  schedule_unlock: {
    label: '📅 Desbloqueo de Horario',
    shortDesc: 'Sugiere horarios alternativos por alta tasa de cancelación de clases',
    defaultAction: 'push',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  payment_assist: {
    label: '💳 Apoyo en Renovación',
    shortDesc: 'Contacto proactivo para destrabar fricción en cobro y proteger puntos',
    defaultAction: 'ticket',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  human_care: {
    label: '🤝 Atención Personalizada',
    shortDesc: 'Abre hilo directo de gerencia tras tickets de soporte recientes',
    defaultAction: 'ticket',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  habit_boost: {
    label: '💪 Impulso de Hábito',
    shortDesc: 'Mensaje empático para retomar ritmo semanal con sesión corta',
    defaultAction: 'push',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
};

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
      savedRevenue30d: 0,
      recoveredMembers30d: 0,
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

function playbookInfo(id?: RetentionPlaybookId) {
  return PLAYBOOK_META[id || 'habit_boost'] || PLAYBOOK_META.habit_boost;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatInterventionAge(iso?: string): string {
  if (!iso) return '';
  const diffMs = Date.now() - Date.parse(iso);
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  if (days === 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  return `hace ${days} días`;
}

async function openPlaybookModal(
  member: ChurnMember,
  forcedAction?: 'push' | 'bonus_push' | 'ticket',
) {
  activeMember.value = member;
  const pb = member.suggested_playbook || 'habit_boost';
  selectedPlaybook.value = pb;
  selectedAction.value = forcedAction || PLAYBOOK_META[pb].defaultAction;
  playbookModalOpen.value = true;
  await fetchPlaybookPreview();
}

async function fetchPlaybookPreview() {
  if (!activeMember.value) return;
  generatingPreview.value = true;
  try {
    const res = await $api<{
      title: string;
      message: string;
      aiPowered: boolean;
    }>('/api/analytics/reengage-member', {
      method: 'POST',
      body: {
        memberId: activeMember.value.id,
        action: selectedAction.value,
        playbook: selectedPlaybook.value,
        preview: true,
      },
    });
    draftTitle.value = res.title;
    draftMessage.value = res.message;
    draftAiPowered.value = res.aiPowered;
  } catch (err: any) {
    toast.add({
      title: 'Error al generar borrador',
      description: err?.message || 'No se pudo generar el mensaje.',
      color: 'error',
    });
  } finally {
    generatingPreview.value = false;
  }
}

async function executePlaybook() {
  if (!activeMember.value || executingPlaybook.value) return;
  executingPlaybook.value = true;
  try {
    const res = await $api<{
      success: boolean;
      message: string;
      bonusAwarded?: number;
      intervention?: ChurnMember['last_intervention'];
    }>('/api/analytics/reengage-member', {
      method: 'POST',
      body: {
        memberId: activeMember.value.id,
        action: selectedAction.value,
        playbook: selectedPlaybook.value,
        title: draftTitle.value.trim(),
        message: draftMessage.value.trim(),
      },
    });

    if (res.intervention) {
      activeMember.value.last_intervention = res.intervention;
    }
    if (res.bonusAwarded) {
      activeMember.value.points = (activeMember.value.points || 0) + res.bonusAwarded;
    }

    toast.add({
      title: 'Jugada ejecutada',
      description: res.message,
      color: 'success',
    });
    playbookModalOpen.value = false;
  } catch (err: any) {
    toast.add({
      title: 'Error al ejecutar jugada',
      description: err?.message || 'No se pudo completar la acción.',
      color: 'error',
    });
  } finally {
    executingPlaybook.value = false;
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
      suggested_playbook: RetentionPlaybookId;
      provider: string;
    }>('/api/analytics/churn-score', {
      method: 'POST',
      body: { member_id: member.id },
    });

    member.churn_risk_ml = res.churn_probability;
    member.churn_risk_level = res.risk_level;
    member.churn_top_factors = res.top_factors;
    member.suggested_playbook = res.suggested_playbook;
    member.churn_provider = res.provider as any;

    toast.add({
      title: 'Score actualizado',
      description: `Riesgo: ${(res.churn_probability * 100).toFixed(0)}% · Jugada: ${playbookInfo(res.suggested_playbook).label}`,
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
          Agente de Retención &amp; Churn IA
        </h1>
        <p class="text-muted-foreground mt-1 text-sm">
          Playbooks contextuales con Google Gemini, bonos de rescate de racha y atribución de ingresos salvados
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

    <!-- KPIs de Riesgo e Ingresos Salvados -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <UCard class="border-l-4 border-l-emerald-500 bg-emerald-500/5">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-emerald-500/15 rounded-xl text-emerald-400">
            <DollarSign class="w-5 h-5" />
          </div>
          <div>
            <div class="text-2xl font-black text-emerald-400">
              {{ formatMoney(kpis.savedRevenue30d) }}
            </div>
            <div class="text-xs text-muted-foreground">
              Ingresos Salvados (30d) · {{ kpis.recoveredMembers30d }} recup.
            </div>
          </div>
        </div>
      </UCard>

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
            Causas ordenadas por peso matemático real en el modelo
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
              <NuxtLink
                :to="`/socios/${member.id}`"
                class="font-semibold text-base hover:text-accent transition"
              >
                {{ member.name }}
              </NuxtLink>
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

              <!-- Jugada Recomendada -->
              <span
                class="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                :class="playbookInfo(member.suggested_playbook).badgeClass"
              >
                {{ playbookInfo(member.suggested_playbook).label }}
              </span>

              <!-- Estado de Intervención -->
              <span
                v-if="member.last_intervention?.convertedPaymentId"
                class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400"
              >
                💰 Renovó membresía
              </span>
              <span
                v-else-if="member.last_intervention?.returnedAt"
                class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400"
              >
                ✨ Regresó al gym
              </span>
              <span
                v-else-if="member.last_intervention?.at"
                class="inline-flex items-center gap-1 text-[10px] text-text-muted px-2 py-0.5 rounded-full bg-base border border-stroke"
              >
                Intervenido {{ formatInterventionAge(member.last_intervention.at) }}
              </span>

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
                <Gift class="w-3.5 h-3.5 text-accent" />
                Puntos: {{ member.points }} pts
              </span>
            </div>

            <!-- Factores explicativos de IA -->
            <div v-if="member.churn_top_factors?.length" class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-[11px] text-muted-foreground">Factores principales:</span>
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
              variant="solid"
              color="primary"
              @click="openPlaybookModal(member)"
            >
              <Sparkles class="w-3.5 h-3.5 mr-1" />
              Jugada IA
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Modal de Jugada IA con Gemini -->
    <UModal
      v-model:open="playbookModalOpen"
      :title="`Jugada de Retención IA · ${activeMember?.name ?? ''}`"
      :description="playbookInfo(selectedPlaybook).shortDesc"
    >
      <template #body>
        <div v-if="activeMember" class="space-y-4">
          <!-- Selector de Canal / Acción -->
          <div>
            <label class="text-xs font-semibold text-text-muted block mb-1.5">
              Acción a ejecutar
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="rounded-xl border p-2.5 text-left text-xs transition cursor-pointer"
                :class="
                  selectedAction === 'bonus_push'
                    ? 'border-accent bg-accent/15 text-text-primary font-bold'
                    : 'border-stroke bg-base text-text-muted hover:text-text-primary'
                "
                @click="
                  selectedAction = 'bonus_push';
                  fetchPlaybookPreview();
                "
              >
                🔥 Bono +25 pts + Push
              </button>
              <button
                type="button"
                class="rounded-xl border p-2.5 text-left text-xs transition cursor-pointer"
                :class="
                  selectedAction === 'push'
                    ? 'border-accent bg-accent/15 text-text-primary font-bold'
                    : 'border-stroke bg-base text-text-muted hover:text-text-primary'
                "
                @click="
                  selectedAction = 'push';
                  fetchPlaybookPreview();
                "
              >
                🔔 Push Directo
              </button>
              <button
                type="button"
                class="rounded-xl border p-2.5 text-left text-xs transition cursor-pointer"
                :class="
                  selectedAction === 'ticket'
                    ? 'border-accent bg-accent/15 text-text-primary font-bold'
                    : 'border-stroke bg-base text-text-muted hover:text-text-primary'
                "
                @click="
                  selectedAction = 'ticket';
                  fetchPlaybookPreview();
                "
              >
                💬 Abrir Chat Soporte
              </button>
            </div>
          </div>

          <!-- Contexto del socio -->
          <div class="rounded-xl border border-stroke bg-base p-3 text-xs space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-text-muted">Ausencia: <strong class="text-text-primary">{{ activeMember.days_since_last_visit }} días</strong></span>
              <span class="text-text-muted">Saldo actual: <strong class="text-accent">{{ activeMember.points }} pts</strong></span>
              <span class="text-text-muted">Frecuencia: <strong class="text-text-primary">{{ activeMember.avg_visits_per_week_last_4.toFixed(1) }}/sem</strong></span>
            </div>
          </div>

          <div v-if="generatingPreview" class="py-8 text-center text-xs text-text-muted flex flex-col items-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-accent" />
            Redactando mensaje personalizado con contexto del socio...
          </div>

          <div v-else class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-text-muted">
                Mensaje personalizado (editable)
              </span>
              <span class="text-[10px] px-2 py-0.5 rounded-full border border-stroke text-text-dim">
                {{ draftAiPowered ? '✨ Redactado con Google Gemini' : '⚡ Motor Contextual IA' }}
              </span>
            </div>

            <div v-if="selectedAction !== 'ticket'">
              <label class="text-[11px] text-text-dim block mb-1">Título de la notificación</label>
              <input
                v-model="draftTitle"
                type="text"
                class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="text-[11px] text-text-dim block mb-1">Cuerpo del mensaje</label>
              <textarea
                v-model="draftMessage"
                rows="3"
                class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full items-center justify-between gap-2">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            :loading="generatingPreview"
            @click="fetchPlaybookPreview"
          >
            Regenerar con IA
          </UButton>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              label="Cancelar"
              @click="playbookModalOpen = false"
            />
            <UButton
              color="primary"
              :loading="executingPlaybook"
              :disabled="generatingPreview || !draftMessage.trim()"
              :label="
                selectedAction === 'bonus_push'
                  ? 'Acreditar +25 pts y Enviar Push'
                  : selectedAction === 'ticket'
                    ? 'Enviar a Chat de Soporte'
                    : 'Enviar Push ahora'
              "
              @click="executePlaybook"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
