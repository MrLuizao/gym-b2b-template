<script setup lang="ts">
import type { Branch, Trainer } from '#shared/types';

const branches = ref<Branch[]>([]);
const trainers = ref<Trainer[]>([]);
const pending = ref(true);

onMounted(async () => {
  try {
    const [branchList, trainerList] = await Promise.all([
      $fetch<Branch[]>('/api/branches'),
      $fetch<Trainer[]>('/api/trainers'),
    ]);
    branches.value = branchList;
    trainers.value = trainerList;
  } finally {
    pending.value = false;
  }
});

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? '—';
}

function shiftMeta(shift: string): string {
  switch (shift) {
    case 'MAÑANA':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-400';
    case 'NOCHE':
      return 'border-violet-400/30 bg-violet-400/10 text-violet-400';
    default:
      return 'border-accent/30 bg-accent/10 text-accent';
  }
}

const dutyModalOpen = ref(false);
const trainerToToggle = ref<Trainer | null>(null);
const togglingDuty = ref(false);

const dutyDescription = computed(() => {
  const t = trainerToToggle.value;
  if (!t) return '';
  return t.isOnDuty
    ? `${t.name} se marcará como fuera de turno y dejará de aparecer como disponible en la app.`
    : `${t.name} se marcará en turno y aparecerá como disponible en la app.`;
});

function confirmToggleDuty(trainer: Trainer): void {
  trainerToToggle.value = trainer;
  dutyModalOpen.value = true;
}

async function runToggleDuty(): Promise<void> {
  const t = trainerToToggle.value;
  if (!t || togglingDuty.value) return;
  togglingDuty.value = true;
  try {
    const updated = await $fetch<Trainer>(`/api/trainers/${t.id}/duty`, {
      method: 'POST',
    });
    const index = trainers.value.findIndex((x) => x.id === t.id);
    if (index !== -1) trainers.value[index] = updated;
    dutyModalOpen.value = false;
    trainerToToggle.value = null;
  } finally {
    togglingDuty.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-xs font-semibold text-text-dim">
      Activa o desactiva el turno de cada entrenador — se refleja al instante en
      la app móvil.
    </p>

    <div
      v-if="pending"
      class="rounded-2xl border border-stroke bg-surface p-8 text-center text-xs font-semibold text-text-dim"
    >
      Cargando entrenadores…
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="trainer in trainers"
        :key="trainer.id"
        class="rounded-2xl border border-stroke bg-surface p-5"
      >
        <div class="flex items-center gap-4">
          <img
            :src="trainer.photoUrl"
            :alt="trainer.name"
            class="h-14 w-14 rounded-2xl border border-stroke object-cover"
          />
          <div class="min-w-0 flex-1">
            <button
              class="cursor-pointer truncate text-left text-sm font-black text-text-primary transition hover:text-accent hover:underline"
              @click="navigateTo(`/entrenadores/${trainer.id}`)"
            >
              {{ trainer.name }}
            </button>
            <p class="truncate text-[11px] text-text-dim">
              {{ trainer.specialty }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <span
            class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
            :class="
              trainer.shift === 'MAÑANA'
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                : trainer.shift === 'NOCHE'
                  ? 'border-violet-400/30 bg-violet-400/10 text-violet-400'
                  : 'border-accent/30 bg-accent/10 text-accent'
            "
          >
            {{ trainer.shift }}
          </span>
          <div class="flex max-w-[55%] flex-wrap justify-end gap-1">
            <button
              v-for="bid in trainer.branchIds"
              :key="bid"
              type="button"
              class="cursor-pointer rounded-full border border-stroke bg-base px-2 py-0.5 text-[9px] font-bold text-text-dim transition hover:border-accent hover:text-accent"
              @click="navigateTo(`/sedes/${bid}`)"
            >
              {{ branchName(bid) }}
            </button>
          </div>
        </div>

        <div
          class="mt-4 flex items-center justify-between border-t border-stroke pt-3"
        >
          <span class="text-[11px] font-bold text-text-muted">En turno</span>
          <button
            class="relative h-6 w-11 rounded-full transition"
            :class="
              trainer.isOnDuty ? 'bg-accent' : 'bg-base border border-stroke'
            "
            :title="
              trainer.isOnDuty
                ? 'Marcar como fuera de turno'
                : 'Marcar en turno'
            "
            @click="confirmToggleDuty(trainer)"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="
                trainer.isOnDuty
                  ? 'left-[22px] bg-base'
                  : 'left-0.5 bg-white'
              "
            />
          </button>
        </div>
      </div>
    </div>

    <UModal
      v-model:open="dutyModalOpen"
      title="Cambiar estado de turno"
      :description="dutyDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="dutyModalOpen = false"
          />
          <UButton
            :label="
              trainerToToggle?.isOnDuty
                ? 'Marcar fuera de turno'
                : 'Marcar en turno'
            "
            :color="trainerToToggle?.isOnDuty ? 'warning' : 'primary'"
            :loading="togglingDuty"
            @click="runToggleDuty"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
