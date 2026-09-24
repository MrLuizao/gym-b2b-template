<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue';

import type { Branch } from '#shared/types';

const props = defineProps<{
  branch: Branch;
  canAdjust?: boolean;
  busy?: boolean;
  closing?: boolean;
}>();

/// Trabajo en vuelo: ajuste manual (busy) o cierre de sede (closing).
const working = computed(() => props.busy || props.closing);

const { session } = useAuth();
const canViewBranch = computed(() =>
  canAccess(session.value?.role, '/sedes'),
);

const emit = defineEmits<{
  adjust: [delta: number];
  set: [value: number];
}>();

/// "Fijar aforo" — el número abre un popover para escribir el valor exacto.
const setOpen = ref(false);
const setInput = ref(0);

function openSet(): void {
  if (props.canAdjust === false) return;
  setInput.value = props.branch.currentCapacity;
  setOpen.value = true;
}

function submitSet(): void {
  const v = Math.round(Number(setInput.value));
  if (!Number.isFinite(v)) return;
  const max = props.branch.maxCapacity;
  emit('set', Math.max(0, max > 0 ? Math.min(max, v) : v));
  setOpen.value = false;
}

const ratio = computed(() =>
  props.branch.maxCapacity > 0
    ? props.branch.currentCapacity / props.branch.maxCapacity
    : 0,
);

const barWidth = computed(() => `${Math.min(100, Math.round(ratio.value * 100))}%`);

const barColor = computed(() => {
  if (ratio.value < 0.5) return 'bg-emerald-400';
  if (ratio.value <= 0.8) return 'bg-amber-400';
  return 'bg-red-400';
});
</script>

<template>
  <div class="rounded-2xl border border-stroke bg-surface p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <button
          type="button"
          :disabled="!canViewBranch"
          class="block text-left text-sm font-black tracking-tight transition"
          :class="
            canViewBranch
              ? 'cursor-pointer text-accent hover:underline'
              : 'cursor-default text-text-primary'
          "
          @click="canViewBranch && navigateTo(`/sedes/${branch.id}`)"
        >
          {{ branch.name }}
        </button>
        <p class="mt-0.5 text-[11px] font-medium text-text-dim">{{ branch.address }}</p>
      </div>
      <OccupancyBadge :ratio="ratio" />
    </div>

    <div class="mt-4 flex items-baseline gap-2">
      <UPopover v-model:open="setOpen">
        <button
          type="button"
          :disabled="canAdjust === false || working"
          title="Fijar aforo manualmente"
          class="cursor-pointer rounded-md px-1 -mx-1 text-left transition enabled:hover:bg-white/5 disabled:cursor-default"
          @click="openSet"
        >
          <span
            class="text-2xl font-black text-text-primary"
            :class="[
              working && 'animate-pulse',
              closing ? 'text-red-400' : busy && 'text-accent',
            ]"
            >{{ branch.currentCapacity }}</span
          >
        </button>
        <template #content>
          <div class="w-44 p-3">
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Fijar aforo
            </p>
            <input
              v-model.number="setInput"
              type="number"
              min="0"
              :max="branch.maxCapacity"
              class="mt-2 w-full rounded-lg border border-stroke bg-base px-2.5 py-1.5 text-sm font-bold text-text-primary outline-none focus:border-accent"
              @keyup.enter="submitSet"
            />
            <UButton
              label="Establecer"
              size="xs"
              block
              class="mt-2"
              @click="submitSet"
            />
          </div>
        </template>
      </UPopover>
      <span class="text-xs font-bold text-text-dim"
        >/ {{ branch.maxCapacity }} aforo</span
      >
    </div>

    <div class="mt-2 h-2 overflow-hidden rounded-full bg-base">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="barColor"
        :style="{ width: barWidth }"
      />
    </div>

    <div v-if="canAdjust !== false" class="mt-4 flex items-center gap-2">
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke bg-white/5 text-text-muted transition hover:border-accent/50 hover:text-text-primary disabled:opacity-40"
        :disabled="working || branch.currentCapacity <= 0"
        title="Registrar salida manual"
        @click="emit('adjust', -1)"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-base transition hover:brightness-110 disabled:opacity-40"
        :disabled="working || branch.currentCapacity >= branch.maxCapacity"
        title="Registrar ingreso manual"
        @click="emit('adjust', 1)"
      >
        <Plus class="h-3.5 w-3.5" />
      </button>
      <span
        class="ml-auto text-[10px] font-bold uppercase tracking-widest"
        :class="[
          working && 'animate-pulse',
          closing ? 'text-red-400' : busy ? 'text-accent' : 'text-text-dim',
        ]"
      >
        {{ closing ? 'Cerrando…' : busy ? 'Guardando…' : 'Ajuste manual' }}
      </span>
    </div>
  </div>
</template>
