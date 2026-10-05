<script setup lang="ts">
import {
  CalendarDays,
  CheckCircle2,
  Coffee,
  Dumbbell,
  Gift,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Shirt,
  Ticket,
  Trophy,
  Users,
} from '@lucide/vue';

import type { Reward } from '#shared/types';

const { rewards, redemptions, pending, load, createReward, updateReward, useCode } =
  useRewards();
const { session } = useAuth();
/// El catálogo es global — solo admin crea/edita. Gerente y recepción
/// ven la lista y validan códigos de su sede.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const ICONS = {
  cup: Coffee,
  users: Users,
  dumbbell: Dumbbell,
  calendar: CalendarDays,
  shirt: Shirt,
  gift: Gift,
} as const;
const ICON_OPTIONS = Object.keys(ICONS);
function iconFor(id: string) {
  return ICONS[id as keyof typeof ICONS] ?? Gift;
}

const activeRewards = computed(() => rewards.value.filter((r) => r.active));
const activeRedemptions = computed(() =>
  redemptions.value.filter((r) => r.status === 'active'),
);
const usedRedemptions = computed(() =>
  redemptions.value.filter((r) => r.status === 'used'),
);
const spentPoints = computed(() =>
  usedRedemptions.value.reduce((sum, r) => sum + r.pointsSpent, 0),
);

/// ── Crear / editar recompensa ──
const editing = ref<Reward | null>(null);
const showForm = ref(false);
const form = ref({ name: '', description: '', pointsCost: 50, icon: 'gift' });
const saving = ref(false);
const formError = ref('');

function openCreate() {
  editing.value = null;
  form.value = { name: '', description: '', pointsCost: 50, icon: 'gift' };
  formError.value = '';
  showForm.value = true;
}
function openEdit(reward: Reward) {
  editing.value = reward;
  form.value = {
    name: reward.name,
    description: reward.description,
    pointsCost: reward.pointsCost,
    icon: reward.icon,
  };
  formError.value = '';
  showForm.value = true;
}
async function saveReward() {
  saving.value = true;
  formError.value = '';
  try {
    if (editing.value) {
      await updateReward(editing.value, { ...form.value });
    } else {
      await createReward({ ...form.value });
    }
    showForm.value = false;
  } catch {
    formError.value = 'No se pudo guardar la recompensa';
  } finally {
    saving.value = false;
  }
}
async function toggleActive(reward: Reward) {
  await updateReward(reward, { active: !reward.active });
}

/// ── Validación de código en recepción ──
const codeInput = ref('');
const codeError = ref('');
const codeOk = ref('');
const validating = ref(false);

async function validateCode() {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;
  validating.value = true;
  codeError.value = '';
  codeOk.value = '';
  try {
    const used = await useCode(code);
    codeOk.value = `${used.rewardName} entregada a ${used.memberName}`;
    codeInput.value = '';
  } catch {
    codeError.value = 'Código inválido, ya usado o expirado';
  } finally {
    validating.value = false;
  }
}

function fmtDate(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <!-- KPIs -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Gift class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Recompensas
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ activeRewards.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">activas en la app</p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Ticket class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Canjes vigentes
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ activeRedemptions.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          pendientes de entregar
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <CheckCircle2 class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Entregados
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ usedRedemptions.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          canjes ya redimidos
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Trophy class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Puntos canjeados
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ spentPoints }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          pts convertidos en premios
        </p>
      </div>
    </div>

    <!-- Validación de código -->
    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2 class="text-sm font-black uppercase tracking-widest text-text-muted">
        Validar código en recepción
      </h2>
      <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
        El socio muestra su código en la app — teclea y entrega la recompensa
      </p>
      <div class="mt-4 flex max-w-md gap-2">
        <input
          v-model="codeInput"
          type="text"
          placeholder="RWR-XXXXXX"
          class="flex-1 rounded-xl border border-stroke bg-base px-4 py-2 font-mono text-sm font-bold uppercase tracking-widest text-text-primary outline-none focus:border-accent"
          @keyup.enter="validateCode"
        />
        <button
          class="cursor-pointer rounded-xl bg-accent px-5 py-2 text-[11px] font-black uppercase text-base transition hover:opacity-90 disabled:opacity-40"
          :disabled="validating || !codeInput.trim()"
          @click="validateCode"
        >
          Validar
        </button>
      </div>
      <p v-if="codeOk" class="mt-2 text-xs font-bold text-emerald-400">
        {{ codeOk }}
      </p>
      <p v-if="codeError" class="mt-2 text-xs font-bold text-rose-400">
        {{ codeError }}
      </p>
    </section>

    <!-- Catálogo de recompensas -->
    <section>
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2
            class="text-sm font-black uppercase tracking-widest text-text-muted"
          >
            Catálogo
          </h2>
          <p class="mt-0.5 text-[10px] font-semibold text-accent">
            Lo que el socio puede canjear con sus puntos
          </p>
        </div>
        <button
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
          @click="openCreate"
        >
          <Plus class="h-3.5 w-3.5" />
          Nueva recompensa
        </button>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Recompensa</th>
              <th class="px-5 py-3 font-bold">Costo</th>
              <th class="px-5 py-3 font-bold">Estado</th>
              <th v-if="isAdmin" class="px-5 py-3 text-right font-bold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td colspan="4" class="px-5 py-8 text-center text-sm text-text-dim">
                Cargando…
              </td>
            </tr>
            <tr v-else-if="!rewards.length">
              <td colspan="4" class="px-5 py-8 text-center text-sm text-text-dim">
                Sin recompensas en el catálogo
              </td>
            </tr>
            <tr
              v-for="reward in rewards"
              :key="reward.id"
              class="border-b border-stroke last:border-0"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10"
                  >
                    <component :is="iconFor(reward.icon)" class="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p class="text-[13px] font-bold text-text-primary">
                      {{ reward.name }}
                    </p>
                    <p class="text-[11px] text-text-dim">
                      {{ reward.description }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-black text-accent"
                >
                  {{ reward.pointsCost }} PTS
                </span>
              </td>
              <td class="px-5 py-3">
                <span
                  class="text-[11px] font-black uppercase"
                  :class="reward.active ? 'text-emerald-400' : 'text-text-dim'"
                >
                  {{ reward.active ? 'Activa' : 'Pausada' }}
                </span>
              </td>
              <td v-if="isAdmin" class="px-5 py-3">
                <div class="flex justify-end gap-1">
                  <button
                    class="cursor-pointer rounded-lg p-2 text-text-dim transition hover:bg-base hover:text-text-primary"
                    title="Editar"
                    @click="openEdit(reward)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="cursor-pointer rounded-lg p-2 text-text-dim transition hover:bg-base hover:text-text-primary"
                    :title="reward.active ? 'Pausar' : 'Activar'"
                    @click="toggleActive(reward)"
                  >
                    <PauseCircle v-if="reward.active" class="h-4 w-4" />
                    <PlayCircle v-else class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Canjes -->
    <section>
      <h2
        class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
      >
        Canjes de socios
      </h2>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Socio</th>
              <th class="px-5 py-3 font-bold">Recompensa</th>
              <th class="px-5 py-3 font-bold">Código</th>
              <th class="px-5 py-3 font-bold">Canjeado</th>
              <th class="px-5 py-3 font-bold">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pending && !redemptions.length">
              <td colspan="5" class="px-5 py-8 text-center text-sm text-text-dim">
                Aún no hay canjes — aparecen cuando el socio canjea en la app
              </td>
            </tr>
            <tr
              v-for="r in redemptions"
              :key="r.id"
              class="border-b border-stroke last:border-0"
            >
              <td class="px-5 py-3 text-[13px] font-bold text-text-primary">
                {{ r.memberName }}
              </td>
              <td class="px-5 py-3 text-[12px] text-text-muted">
                {{ r.rewardName }} · {{ r.pointsSpent }} pts
              </td>
              <td class="px-5 py-3">
                <span
                  class="font-mono text-[12px] font-black tracking-widest text-accent"
                >
                  {{ r.code }}
                </span>
              </td>
              <td class="px-5 py-3 text-[12px] text-text-dim">
                {{ fmtDate(r.createdAt) }}
              </td>
              <td class="px-5 py-3">
                <span
                  class="text-[11px] font-black uppercase"
                  :class="{
                    'text-amber-400': r.status === 'active',
                    'text-emerald-400': r.status === 'used',
                    'text-text-dim': r.status === 'expired',
                  }"
                >
                  {{
                    r.status === 'active'
                      ? 'Vigente'
                      : r.status === 'used'
                        ? 'Usado'
                        : 'Expirado'
                  }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal crear/editar -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click.self="showForm = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-stroke bg-surface p-6">
          <h3 class="text-base font-black text-text-primary">
            {{ editing ? 'Editar recompensa' : 'Nueva recompensa' }}
          </h3>
          <div class="mt-4 space-y-3">
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Nombre</span
              >
              <input
                v-model="form.name"
                type="text"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-4 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Descripción</span
              >
              <input
                v-model="form.description"
                type="text"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-4 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <div class="flex gap-3">
              <label class="block flex-1">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >Costo (pts)</span
                >
                <input
                  v-model.number="form.pointsCost"
                  type="number"
                  min="1"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-4 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label class="block flex-1">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >Icono</span
                >
                <select
                  v-model="form.icon"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-4 py-2 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option v-for="i in ICON_OPTIONS" :key="i" :value="i">
                    {{ i }}
                  </option>
                </select>
              </label>
            </div>
            <p v-if="formError" class="text-xs font-bold text-rose-400">
              {{ formError }}
            </p>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button
              class="cursor-pointer rounded-xl px-4 py-2 text-[11px] font-black uppercase text-text-dim transition hover:text-text-primary"
              @click="showForm = false"
            >
              Cancelar
            </button>
            <button
              class="cursor-pointer rounded-xl bg-accent px-5 py-2 text-[11px] font-black uppercase text-base transition hover:opacity-90 disabled:opacity-40"
              :disabled="saving || form.name.trim().length < 3"
              @click="saveReward"
            >
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
