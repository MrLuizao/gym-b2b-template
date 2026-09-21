<script setup lang="ts">
import { ArrowLeft, Check, Pencil, Trash2, X } from '@lucide/vue';

import type { Branch, ClassDetail, Trainer } from '#shared/types';

const route = useRoute();
const detail = ref<ClassDetail | null>(null);
const branches = ref<Branch[]>([]);
const trainers = ref<Trainer[]>([]);
const pending = ref(true);
const saving = ref(false);
const editing = ref(false);

const editForm = ref({
  name: '',
  coach: '',
  branchIds: [] as string[],
  room: '',
  start: '06:00',
  end: '07:00',
  capacity: 20,
  booked: 0,
});

const branchItems = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.id })),
);

const coachItems = computed(() =>
  trainers.value
    .filter((t) =>
      t.branchIds.some((b) => editForm.value.branchIds.includes(b)),
    )
    .map((t) => ({ label: `${t.name} — ${t.specialty}`, value: t.name })),
);

const deleteModalOpen = ref(false);
const deleting = ref(false);

const saveModalOpen = ref(false);
const saveModalDescription = ref('');
const saveModalEmpty = ref(false);

const classChanges = computed<string[]>(() => {
  const c = detail.value?.gymClass;
  if (!c) return [];
  const changes: string[] = [];
  if (editForm.value.name !== c.name)
    changes.push(`Nombre: '${c.name}' → '${editForm.value.name}'`);
  const addedBranches = editForm.value.branchIds
    .filter((b) => !c.branchIds.includes(b))
    .map(branchName);
  const removedBranches = c.branchIds
    .filter((b) => !editForm.value.branchIds.includes(b))
    .map(branchName);
  if (addedBranches.length)
    changes.push(`Se impartirá también en: ${addedBranches.join(', ')}`);
  if (removedBranches.length)
    changes.push(`Dejará de impartirse en: ${removedBranches.join(', ')}`);
  if (editForm.value.branchIds.length === 0)
    changes.push('La clase quedará sin sede asignada');
  if (editForm.value.coach !== c.coach)
    changes.push(`Coach: ${c.coach} → ${editForm.value.coach}`);
  if (editForm.value.room !== c.room)
    changes.push(`Sala: ${c.room} → ${editForm.value.room}`);
  if (
    toMinutes(editForm.value.start) !== c.startMinutes ||
    toMinutes(editForm.value.end) !== c.endMinutes
  )
    changes.push(
      `Horario: ${hhmm(c.startMinutes)}–${hhmm(c.endMinutes)} → ${editForm.value.start}–${editForm.value.end}`,
    );
  if (editForm.value.capacity !== c.capacity)
    changes.push(`Capacidad: ${c.capacity} → ${editForm.value.capacity}`);
  if (editForm.value.booked !== c.booked)
    changes.push(`Inscritos: ${c.booked} → ${editForm.value.booked}`);
  if (editForm.value.booked > editForm.value.capacity)
    changes.push('Los inscritos exceden la capacidad — se ajustarán al máximo');
  return changes;
});

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? '—';
}

function confirmSave(): void {
  saveModalDescription.value = classChanges.value.length
    ? `${classChanges.value.join('. ')}.`
    : 'No se detectaron cambios respecto a los datos actuales.';
  saveModalEmpty.value = classChanges.value.length === 0;
  saveModalOpen.value = true;
}

async function runSave(): Promise<void> {
  await saveClass();
  saveModalOpen.value = false;
}

onMounted(async () => {
  try {
    const [branchList, trainerList, classDetail] = await Promise.all([
      $fetch<Branch[]>('/api/branches'),
      $fetch<Trainer[]>('/api/trainers'),
      $fetch<ClassDetail>(`/api/classes/${route.params.id}`),
    ]);
    branches.value = branchList;
    trainers.value = trainerList;
    detail.value = classDetail;
  } finally {
    pending.value = false;
  }
});

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function occupancy(): number {
  const c = detail.value?.gymClass;
  return c && c.capacity > 0 ? c.booked / c.capacity : 0;
}

function startEdit(): void {
  const c = detail.value?.gymClass;
  if (!c) return;
  editForm.value = {
    name: c.name,
    coach: c.coach,
    branchIds: [...c.branchIds],
    room: c.room,
    start: hhmm(c.startMinutes),
    end: hhmm(c.endMinutes),
    capacity: c.capacity,
    booked: c.booked,
  };
  editing.value = true;
}

async function saveClass(): Promise<void> {
  if (!detail.value || saving.value) return;
  saving.value = true;
  try {
    const updated = await $fetch<ClassDetail['gymClass']>(
      `/api/classes/${detail.value.gymClass.id}`,
      {
        method: 'PUT',
        body: {
          name: editForm.value.name,
          coach: editForm.value.coach,
          branchIds: editForm.value.branchIds,
          room: editForm.value.room,
          startMinutes: toMinutes(editForm.value.start),
          endMinutes: toMinutes(editForm.value.end),
          capacity: editForm.value.capacity,
          booked: editForm.value.booked,
        },
      },
    );
    detail.value = await $fetch<ClassDetail>(`/api/classes/${updated.id}`);
    editing.value = false;
  } finally {
    saving.value = false;
  }
}

async function deleteClass(): Promise<void> {
  if (!detail.value || deleting.value) return;
  deleting.value = true;
  try {
    await $fetch(`/api/classes/${detail.value.gymClass.id}`, {
      method: 'DELETE',
    });
    await navigateTo('/clases');
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div
    v-if="pending"
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cargando clase…
  </div>

  <div v-else-if="detail" class="space-y-6">
    <div class="flex items-center gap-4">
      <div
        class="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-stroke bg-surface"
      >
        <p class="text-sm font-black text-text-primary">
          {{ hhmm(detail.gymClass.startMinutes) }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          {{ hhmm(detail.gymClass.endMinutes) }}
        </p>
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-black text-text-primary">
          {{ detail.gymClass.name }}
        </h1>
        <p class="mt-1 truncate text-[11px] text-text-dim">
          {{ detail.gymClass.coach }} · {{ detail.gymClass.room }}
        </p>
      </div>
      <span
        class="rounded-full border px-3 py-1 text-[11px] font-black"
        :class="
          occupancy() >= 1
            ? 'border-red-400/30 bg-red-400/10 text-red-400'
            : occupancy() >= 0.8
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
        "
      >
        {{ Math.round(occupancy() * 100) }}% OCUPADA
      </span>
    </div>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="flex items-center justify-between">
        <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Información de la clase
        </h2>
        <button
          v-if="!editing"
          class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent"
          @click="startEdit"
        >
          <Pencil class="h-3 w-3" />
          Editar
        </button>
      </div>

      <div v-if="!editing" class="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Sedes
          </p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <button
              v-for="b in detail.branches"
              :key="b.id"
              type="button"
              class="cursor-pointer rounded-full border border-stroke bg-base px-2.5 py-0.5 text-[10px] font-bold text-text-muted transition hover:border-accent hover:text-accent"
              @click="navigateTo(`/sedes/${b.id}`)"
            >
              {{ b.name }}
            </button>
            <span
              v-if="detail.branches.length === 0"
              class="text-sm font-black text-text-primary"
            >
              —
            </span>
          </div>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Coach
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.gymClass.coach }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Sala
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.gymClass.room }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Horario
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ hhmm(detail.gymClass.startMinutes) }} –
            {{ hhmm(detail.gymClass.endMinutes) }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Capacidad
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.gymClass.capacity }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Inscritos
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.gymClass.booked }}
          </p>
        </div>
      </div>

      <div v-else class="mt-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Nombre
            </span>
            <input
              v-model="editForm.name"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Sedes
            </span>
            <USelectMenu
              v-model="editForm.branchIds"
              :items="branchItems"
              value-key="value"
              multiple
              placeholder="Seleccionar sedes…"
              class="mt-1 w-full"
            />
          </label>
          <label class="col-span-2 block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Coach (entrenadores de las sedes)
            </span>
            <USelectMenu
              v-model="editForm.coach"
              :items="coachItems"
              value-key="value"
              placeholder="Seleccionar…"
              class="mt-1 w-full"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Sala
            </span>
            <input
              v-model="editForm.room"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Capacidad
            </span>
            <input
              v-model.number="editForm.capacity"
              type="number"
              min="1"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Inicio
            </span>
            <input
              v-model="editForm.start"
              type="time"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Fin
            </span>
            <input
              v-model="editForm.end"
              type="time"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Inscritos
            </span>
            <input
              v-model.number="editForm.booked"
              type="number"
              min="0"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button
            class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 text-[11px] font-black text-text-muted transition hover:text-text-primary"
            @click="editing = false"
          >
            <X class="h-3.5 w-3.5" />
            Cancelar
          </button>
          <button
            class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-base transition hover:opacity-90 disabled:opacity-50"
            :disabled="saving"
            @click="confirmSave"
          >
            <Check class="h-3.5 w-3.5" />
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    </section>

    <section v-if="detail.trainer">
      <h2 class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted">
        Coach asignado
      </h2>
      <div
        class="flex items-center gap-3 rounded-2xl border border-stroke bg-surface p-4"
      >
        <img
          :src="detail.trainer.photoUrl"
          :alt="detail.trainer.name"
          class="h-12 w-12 rounded-xl border border-stroke object-cover"
        />
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="block max-w-full cursor-pointer truncate text-xs font-bold text-text-primary hover:text-accent hover:underline"
            @click="navigateTo(`/entrenadores/${detail.trainer.id}`)"
          >
            {{ detail.trainer.name }}
          </button>
          <p class="truncate text-[10px] text-text-dim">
            {{ detail.trainer.specialty }} · {{ detail.trainer.shift }}
          </p>
        </div>
        <span
          class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
          :class="
            detail.trainer.isOnDuty
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
              : 'border-stroke bg-base text-text-dim'
          "
        >
          {{ detail.trainer.isOnDuty ? 'EN TURNO' : 'FUERA' }}
        </span>
      </div>
    </section>

    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Ocupación
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ Math.round(occupancy() * 100) }}%
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Cupos libres
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ Math.max(0, detail.gymClass.capacity - detail.gymClass.booked) }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Duración
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ detail.gymClass.endMinutes - detail.gymClass.startMinutes }} min
        </p>
      </div>
    </div>

    <button
      class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-400/40 text-xs font-black text-red-400 transition hover:bg-red-400/10"
      @click="deleteModalOpen = true"
    >
      <Trash2 class="h-4 w-4" />
      Eliminar clase
    </button>

    <UModal
      v-model:open="saveModalOpen"
      title="Guardar cambios de la clase"
      :description="saveModalDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="saveModalOpen = false"
          />
          <UButton
            label="Confirmar cambios"
            :disabled="saveModalEmpty"
            :loading="saving"
            @click="runSave"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteModalOpen"
      title="Eliminar clase"
      :description="`Se eliminará '${detail.gymClass.name}' (${hhmm(detail.gymClass.startMinutes)}–${hhmm(detail.gymClass.endMinutes)} · ${detail.gymClass.coach}) de ${detail.branches.map((b) => b.name).join(', ') || 'la sede'}. Esta acción no se puede deshacer.`"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="deleteModalOpen = false"
          />
          <UButton
            label="Eliminar clase"
            color="error"
            :loading="deleting"
            @click="deleteClass"
          />
        </div>
      </template>
    </UModal>

    <NuxtLink
      to="/clases"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Clases
    </NuxtLink>
  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Clase no encontrada
  </div>
</template>
