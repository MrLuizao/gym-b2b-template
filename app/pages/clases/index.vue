<script setup lang="ts">
import { Plus } from '@lucide/vue';

import type { Branch, ClassSchedule, Trainer } from '#shared/types';

const branches = ref<Branch[]>([]);
const trainers = ref<Trainer[]>([]);
const classes = ref<ClassSchedule[]>([]);
const selectedBranch = ref('todas');
const pending = ref(true);

const createModalOpen = ref(false);
const creating = ref(false);
const createError = ref<string | null>(null);

const createForm = ref({
  name: '',
  coach: '',
  branchIds: [] as string[],
  room: '',
  start: '07:00',
  end: '08:00',
  capacity: 20,
});

const confirmOpen = ref(false);
const confirmTitle = ref('');
const confirmDescription = ref('');
const confirmAction = ref<(() => Promise<void>) | null>(null);
const confirming = ref(false);

onMounted(async () => {
  try {
    const [branchList, classList, trainerList] = await Promise.all([
      $fetch<Branch[]>('/api/branches'),
      $fetch<ClassSchedule[]>('/api/classes'),
      $fetch<Trainer[]>('/api/trainers'),
    ]);
    branches.value = branchList;
    classes.value = classList;
    trainers.value = trainerList;
  } finally {
    pending.value = false;
  }
});

const branchItems = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.id })),
);

const coachItems = computed(() =>
  trainers.value.map((t) => ({ label: t.name, value: t.name })),
);

const filtered = computed(() =>
  selectedBranch.value === 'todas'
    ? classes.value
    : classes.value.filter((c) => c.branchIds.includes(selectedBranch.value)),
);

function branchNames(gymClass: ClassSchedule): string {
  return gymClass.branchIds
    .map((id) => branches.value.find((b) => b.id === id)?.name ?? id)
    .join(' · ');
}

function selectedBranchNames(): string {
  return createForm.value.branchIds
    .map((id) => branches.value.find((b) => b.id === id)?.name ?? id)
    .join(' · ');
}

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function occupancy(gymClass: ClassSchedule): number {
  return gymClass.capacity > 0 ? gymClass.booked / gymClass.capacity : 0;
}

function barColor(ratio: number): string {
  if (ratio < 0.5) return 'bg-emerald-400';
  if (ratio <= 0.8) return 'bg-amber-400';
  return 'bg-red-400';
}

function askConfirm(
  title: string,
  description: string,
  action: () => Promise<void>,
): void {
  confirmTitle.value = title;
  confirmDescription.value = description;
  confirmAction.value = action;
  confirmOpen.value = true;
}

async function runConfirm(): Promise<void> {
  if (!confirmAction.value || confirming.value) return;
  confirming.value = true;
  try {
    await confirmAction.value();
    confirmOpen.value = false;
  } finally {
    confirming.value = false;
  }
}

function submitClass(): void {
  if (createForm.value.name.trim().length < 3) {
    createError.value = 'El nombre es obligatorio (mín. 3 caracteres)';
    return;
  }
  if (!createForm.value.coach) {
    createError.value = 'Selecciona un coach';
    return;
  }
  if (createForm.value.branchIds.length === 0) {
    createError.value = 'Selecciona al menos una sede';
    return;
  }
  createError.value = null;
  askConfirm(
    'Crear clase',
    `Se creará la clase '${createForm.value.name.trim()}' (${createForm.value.start}–${createForm.value.end} · ${createForm.value.coach}) en: ${selectedBranchNames()}.`,
    async () => {
      creating.value = true;
      try {
        const created = await $fetch<ClassSchedule>('/api/classes', {
          method: 'POST',
          body: {
            name: createForm.value.name.trim(),
            coach: createForm.value.coach,
            branchIds: createForm.value.branchIds,
            room: createForm.value.room,
            startMinutes: toMinutes(createForm.value.start),
            endMinutes: toMinutes(createForm.value.end),
            capacity: createForm.value.capacity,
          },
        });
        classes.value.push(created);
        classes.value.sort((a, b) => a.startMinutes - b.startMinutes);
        createForm.value = {
          name: '',
          coach: '',
          branchIds: [],
          room: '',
          start: '07:00',
          end: '08:00',
          capacity: 20,
        };
        createModalOpen.value = false;
      } catch (cause) {
        createError.value =
          cause instanceof Error ? cause.message : 'No se pudo crear la clase';
      } finally {
        creating.value = false;
      }
    },
  );
}
</script>

<template>
  <div class="space-y-6">
    <section>
      <h2 class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted">
        Filtrar por sede
      </h2>
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-full border px-4 py-1.5 text-xs font-bold transition"
          :class="
            selectedBranch === 'todas'
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-stroke bg-surface text-text-dim hover:text-text-muted'
          "
          @click="selectedBranch = 'todas'"
        >
          Todas
        </button>
        <button
          v-for="branch in branches"
          :key="branch.id"
          class="rounded-full border px-4 py-1.5 text-xs font-bold transition"
          :class="
            selectedBranch === branch.id
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-stroke bg-surface text-text-dim hover:text-text-muted'
          "
          @click="selectedBranch = branch.id"
        >
          {{ branch.name }}
        </button>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-black uppercase tracking-widest text-text-muted">
          Clases programadas
        </h2>
        <button
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
          @click="createModalOpen = true"
        >
          <Plus class="h-3.5 w-3.5" />
          Nueva clase
        </button>
      </div>
      <div
        v-for="gymClass in filtered"
        :key="gymClass.id"
        class="flex items-center gap-4 rounded-2xl border border-stroke bg-surface p-4"
      >
        <div class="w-16 text-center">
          <p class="text-sm font-black text-text-primary">
            {{ hhmm(gymClass.startMinutes) }}
          </p>
          <p class="text-[10px] font-semibold text-text-dim">
            {{ hhmm(gymClass.endMinutes) }}
          </p>
        </div>
        <div class="h-10 w-px bg-stroke" />
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="block max-w-full cursor-pointer truncate text-sm font-black text-text-primary transition hover:text-accent hover:underline"
            @click="navigateTo(`/clases/${gymClass.id}`)"
          >
            {{ gymClass.name }}
          </button>
          <p class="truncate text-[11px] text-text-dim">
            {{ gymClass.coach }} · {{ gymClass.room }} ·
            {{ branchNames(gymClass) }}
          </p>
        </div>
        <div class="w-32">
          <div
            class="flex items-center justify-between text-[10px] font-bold text-text-dim"
          >
            <span>{{ gymClass.booked }}/{{ gymClass.capacity }} cupos</span>
            <span>{{ Math.round(occupancy(gymClass) * 100) }}%</span>
          </div>
          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-base">
            <div
              class="h-full rounded-full"
              :class="barColor(occupancy(gymClass))"
              :style="{
                width: `${Math.min(100, Math.round(occupancy(gymClass) * 100))}%`,
              }"
            />
          </div>
        </div>
      </div>

      <p
        v-if="!pending && filtered.length === 0"
        class="py-10 text-center text-xs font-semibold text-text-dim"
      >
        Sin clases programadas para esta sede
      </p>
    </section>

    <UModal
      v-model:open="createModalOpen"
      title="Nueva clase"
      description="La clase podrá impartirse en una o varias sedes."
    >
      <template #body>
        <form class="space-y-3" @submit.prevent="submitClass()">
          <input
            v-model="createForm.name"
            type="text"
            placeholder="Nombre de la clase (ej. Spinning Extreme)"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <div class="grid grid-cols-2 gap-3">
            <USelectMenu
              v-model="createForm.coach"
              :items="coachItems"
              value-key="value"
              placeholder="Coach…"
            />
            <input
              v-model="createForm.room"
              type="text"
              placeholder="Sala (ej. Sala Cycle 1)"
              class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
          </div>
          <USelectMenu
            v-model="createForm.branchIds"
            :items="branchItems"
            value-key="value"
            multiple
            placeholder="Sedes donde se imparte…"
          />
          <div class="grid grid-cols-3 gap-3">
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Inicio
              </span>
              <input
                v-model="createForm.start"
                type="time"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Fin
              </span>
              <input
                v-model="createForm.end"
                type="time"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Capacidad
              </span>
              <input
                v-model.number="createForm.capacity"
                type="number"
                min="1"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>
          <p v-if="createError" class="text-[11px] font-bold text-red-400">
            {{ createError }}
          </p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="createModalOpen = false"
          />
          <UButton
            label="Crear clase"
            icon="i-lucide-plus"
            :loading="creating"
            @click="submitClass"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="confirmOpen = false"
          />
          <UButton
            label="Confirmar"
            :loading="confirming"
            @click="runConfirm"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
