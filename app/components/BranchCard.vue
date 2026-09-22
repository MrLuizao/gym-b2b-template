<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue';

import type { Branch } from '#shared/types';

const props = defineProps<{ branch: Branch; canAdjust?: boolean }>();

const { session } = useAuth();
const canViewBranch = computed(() =>
  canAccess(session.value?.role, '/sedes'),
);

const emit = defineEmits<{ adjust: [delta: number] }>();

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
      <span class="text-2xl font-black text-text-primary">{{ branch.currentCapacity }}</span>
      <span class="text-xs font-bold text-text-dim">/ {{ branch.maxCapacity }} aforo</span>
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
        :disabled="branch.currentCapacity <= 0"
        title="Registrar salida manual"
        @click="emit('adjust', -1)"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-base transition hover:brightness-110 disabled:opacity-40"
        :disabled="branch.currentCapacity >= branch.maxCapacity"
        title="Registrar ingreso manual"
        @click="emit('adjust', 1)"
      >
        <Plus class="h-3.5 w-3.5" />
      </button>
      <span class="ml-auto text-[10px] font-bold uppercase tracking-widest text-text-dim">
        Ajuste manual
      </span>
    </div>
  </div>
</template>
