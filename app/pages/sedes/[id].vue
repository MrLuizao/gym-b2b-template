<script setup lang="ts">
import { ArrowLeft, Check, Pencil, Plus, Trash2, UserPlus, X } from '@lucide/vue';

import type { Branch, BranchDetail, ClassSchedule, MemberAdmin, Trainer } from '#shared/types';

const route = useRoute();
const detail = ref<BranchDetail | null>(null);
const branches = ref<Branch[]>([]);
const pending = ref(true);
const saving = ref(false);
const editing = ref(false);

const editForm = ref({
  name: '',
  address: '',
  imageUrl: '',
  maxCapacity: 1,
  currentCapacity: 0,
  status: 'OPEN' as Branch['status'],
  openTime: '06:00',
  closeTime: '22:00',
});

const editingClassId = ref<string | null>(null);
const classForm = ref({
  name: '',
  coach: '',
  room: '',
  start: '06:00',
  end: '07:00',
  capacity: 20,
  booked: 0,
});

const assignTrainerId = ref('');
const assignClassId = ref('');
const allClasses = ref<ClassSchedule[]>([]);
const allMembers = ref<MemberAdmin[]>([]);

const deleteModalOpen = ref(false);
const deleting = ref(false);

const availableTrainerItems = computed(() =>
  (detail.value?.availableTrainers ?? []).map((t) => ({
    label: `${t.name} — ${t.specialty}`,
    value: t.id,
  })),
);

const coachItems = computed(() =>
  (detail.value?.trainers ?? []).map((t) => ({
    label: t.name,
    value: t.name,
  })),
);

const editingClass = computed(
  () =>
    detail.value?.classes.find((c) => c.id === editingClassId.value) ?? null,
);

const availableClassItems = computed(() =>
  allClasses.value
    .filter(
      (c) =>
        detail.value && !c.branchIds.includes(detail.value.branch.id),
    )
    .map((c) => ({
      label: `${c.name} — ${c.coach} · ${hhmm(c.startMinutes)}`,
      value: c.id,
    })),
);

const saveModalOpen = ref(false);
const saveModalTitle = ref('');
const saveModalDescription = ref('');
const saveModalEmpty = ref(false);
const saveModalAction = ref<(() => Promise<void>) | null>(null);

function confirmSave(
  title: string,
  changes: string[],
  action: () => Promise<void>,
): void {
  saveModalTitle.value = title;
  saveModalDescription.value = changes.length
    ? `${changes.join('. ')}.`
    : 'No se detectaron cambios respecto a los datos actuales.';
  saveModalEmpty.value = changes.length === 0;
  saveModalAction.value = action;
  saveModalOpen.value = true;
}

async function runSave(): Promise<void> {
  if (!saveModalAction.value) return;
  await saveModalAction.value();
  saveModalOpen.value = false;
}

const branchChanges = computed<string[]>(() => {
  const b = detail.value?.branch;
  if (!b) return [];
  const changes: string[] = [];
  if (editForm.value.name !== b.name)
    changes.push(`Nombre: '${b.name}' → '${editForm.value.name}'`);
  if (editForm.value.address !== b.address)
    changes.push('Se actualizará la dirección');
  if (editForm.value.imageUrl !== b.imageUrl)
    changes.push('Se actualizará la imagen de la sede');
  if (editForm.value.maxCapacity !== b.maxCapacity)
    changes.push(
      `Aforo máximo: ${b.maxCapacity} → ${editForm.value.maxCapacity}`,
    );
  if (editForm.value.currentCapacity !== b.currentCapacity)
    changes.push(
      `Aforo actual: ${b.currentCapacity} → ${editForm.value.currentCapacity}`,
    );
  if (editForm.value.status !== b.status)
    changes.push(
      editForm.value.status === 'OPEN'
        ? 'La sede se abrirá al público'
        : 'La sede se cerrará — los socios no podrán hacer check-in',
    );
  if (
    toMinutes(editForm.value.openTime) !== b.openMinutes ||
    toMinutes(editForm.value.closeTime) !== b.closeMinutes
  )
    changes.push(
      `Horario de operación: ${hhmm(b.openMinutes)}–${hhmm(b.closeMinutes)} → ${editForm.value.openTime}–${editForm.value.closeTime}`,
    );
  return changes;
});

const classChanges = computed<string[]>(() => {
  const c = editingClass.value;
  if (!c) return [];
  const changes: string[] = [];
  if (classForm.value.name !== c.name)
    changes.push(`Nombre: '${c.name}' → '${classForm.value.name}'`);
  if (classForm.value.coach !== c.coach)
    changes.push(`Coach: ${c.coach} → ${classForm.value.coach}`);
  if (classForm.value.room !== c.room)
    changes.push(`Sala: ${c.room} → ${classForm.value.room}`);
  if (
    toMinutes(classForm.value.start) !== c.startMinutes ||
    toMinutes(classForm.value.end) !== c.endMinutes
  )
    changes.push(
      `Horario: ${hhmm(c.startMinutes)}–${hhmm(c.endMinutes)} → ${classForm.value.start}–${classForm.value.end}`,
    );
  if (classForm.value.capacity !== c.capacity)
    changes.push(`Capacidad: ${c.capacity} → ${classForm.value.capacity}`);
  if (classForm.value.booked !== c.booked)
    changes.push(`Inscritos: ${c.booked} → ${classForm.value.booked}`);
  if (classForm.value.booked > classForm.value.capacity)
    changes.push('Los inscritos exceden la capacidad — se ajustarán al máximo');
  return changes;
});

onMounted(async () => {
  try {
    const [branchList, classList, memberList] = await Promise.all([
      $fetch<Branch[]>('/api/branches'),
      $fetch<ClassSchedule[]>('/api/classes'),
      $fetch<MemberAdmin[]>('/api/members'),
      load(),
    ]);
    branches.value = branchList;
    allClasses.value = classList;
    allMembers.value = memberList;
  } finally {
    pending.value = false;
  }
});

async function load(): Promise<void> {
  detail.value = await $fetch<BranchDetail>(`/api/branches/${route.params.id}`);
}

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? '—';
}

function otherBranches(trainer: Trainer): string {
  return trainer.branchIds
    .filter((b) => b !== detail.value?.branch.id)
    .map(branchName)
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

function startEdit(): void {
  if (!detail.value) return;
  editForm.value = {
    name: detail.value.branch.name,
    address: detail.value.branch.address,
    imageUrl: detail.value.branch.imageUrl,
    maxCapacity: detail.value.branch.maxCapacity,
    currentCapacity: detail.value.branch.currentCapacity,
    status: detail.value.branch.status,
    openTime: hhmm(detail.value.branch.openMinutes),
    closeTime: hhmm(detail.value.branch.closeMinutes),
  };
  editing.value = true;
}

async function saveBranch(): Promise<void> {
  if (!detail.value || saving.value) return;
  saving.value = true;
  try {
    const updated = await $fetch<Branch>(
      `/api/branches/${detail.value.branch.id}`,
      {
        method: 'PUT',
        body: {
          ...editForm.value,
          openMinutes: toMinutes(editForm.value.openTime),
          closeMinutes: toMinutes(editForm.value.closeTime),
        },
      },
    );
    detail.value = { ...detail.value, branch: updated };
    editing.value = false;
  } finally {
    saving.value = false;
  }
}

function startEditClass(gymClass: ClassSchedule): void {
  editingClassId.value = gymClass.id;
  classForm.value = {
    name: gymClass.name,
    coach: gymClass.coach,
    room: gymClass.room,
    start: hhmm(gymClass.startMinutes),
    end: hhmm(gymClass.endMinutes),
    capacity: gymClass.capacity,
    booked: gymClass.booked,
  };
}

async function saveClass(): Promise<void> {
  if (!detail.value || !editingClassId.value || saving.value) return;
  saving.value = true;
  try {
    const updated = await $fetch<ClassSchedule>(
      `/api/classes/${editingClassId.value}`,
      {
        method: 'PUT',
        body: {
          name: classForm.value.name,
          coach: classForm.value.coach,
          room: classForm.value.room,
          startMinutes: toMinutes(classForm.value.start),
          endMinutes: toMinutes(classForm.value.end),
          capacity: classForm.value.capacity,
          booked: classForm.value.booked,
        },
      },
    );
    const index = detail.value.classes.findIndex((c) => c.id === updated.id);
    if (index !== -1) detail.value.classes[index] = updated;
    editingClassId.value = null;
  } finally {
    saving.value = false;
  }
}

const classToRemove = ref<ClassSchedule | null>(null);
const removeClassModalOpen = ref(false);
const removingClass = ref(false);

const selectedClass = ref<ClassSchedule | null>(null);
const classDetailOpen = ref(false);

function openClassDetail(gymClass: ClassSchedule): void {
  selectedClass.value = gymClass;
  classDetailOpen.value = true;
}

function classDuration(gymClass: ClassSchedule): string {
  return `${gymClass.endMinutes - gymClass.startMinutes} min`;
}

function classFill(gymClass: ClassSchedule): number {
  return gymClass.capacity > 0
    ? Math.min(1, gymClass.booked / gymClass.capacity)
    : 0;
}

const selectedClassBranches = computed(() =>
  (selectedClass.value?.branchIds ?? []).map(branchName),
);

function editSelectedClass(): void {
  if (!selectedClass.value) return;
  startEditClass(selectedClass.value);
  classDetailOpen.value = false;
}

const selectedTrainer = ref<Trainer | null>(null);
const trainerDetailOpen = ref(false);

function openTrainerDetail(trainer: Trainer): void {
  selectedTrainer.value = trainer;
  trainerDetailOpen.value = true;
}

const selectedTrainerBranches = computed(() =>
  (selectedTrainer.value?.branchIds ?? []).map(branchName),
);

const selectedTrainerClasses = computed(
  () =>
    detail.value?.classes.filter(
      (c) => c.coach === selectedTrainer.value?.name,
    ) ?? [],
);

function askRemoveSelectedTrainer(): void {
  const trainer = selectedTrainer.value;
  trainerDetailOpen.value = false;
  if (trainer) confirmRemoveTrainer(trainer);
}

const removeClassDescription = computed(() => {
  if (!classToRemove.value || !detail.value) return '';
  const c = classToRemove.value;
  const others = c.branchIds
    .filter((b) => b !== detail.value!.branch.id)
    .map(branchName)
    .join(' · ');
  return others
    ? `"${c.name}" dejará de impartirse en ${detail.value.branch.name}. Seguirá en: ${others}.`
    : `"${c.name}" dejará de impartirse en ${detail.value.branch.name} y quedará sin sede asignada (podrás reasignarla o eliminarla desde Clases).`;
});

function confirmRemoveClass(gymClass: ClassSchedule): void {
  classToRemove.value = gymClass;
  removeClassModalOpen.value = true;
}

async function removeClass(): Promise<void> {
  if (!detail.value || !classToRemove.value || removingClass.value) return;
  removingClass.value = true;
  try {
    const branchId = detail.value.branch.id;
    await $fetch<ClassSchedule>(`/api/classes/${classToRemove.value.id}`, {
      method: 'PUT',
      body: {
        branchIds: classToRemove.value.branchIds.filter(
          (b) => b !== branchId,
        ),
      },
    });
    detail.value.classes = detail.value.classes.filter(
      (c) => c.id !== classToRemove.value?.id,
    );
    detail.value.stats.classes = detail.value.classes.length;
    const inAll = allClasses.value.find((c) => c.id === classToRemove.value?.id);
    if (inAll) inAll.branchIds = inAll.branchIds.filter((b) => b !== branchId);
    removeClassModalOpen.value = false;
    classToRemove.value = null;
  } finally {
    removingClass.value = false;
  }
}

async function assignClass(): Promise<void> {
  if (!detail.value || !assignClassId.value) return;
  const gymClass = allClasses.value.find((c) => c.id === assignClassId.value);
  if (!gymClass) return;
  const updated = await $fetch<ClassSchedule>(`/api/classes/${gymClass.id}`, {
    method: 'PUT',
    body: { branchIds: [...gymClass.branchIds, detail.value.branch.id] },
  });
  gymClass.branchIds = updated.branchIds;
  assignClassId.value = '';
  await load();
}

const deleteBlockers = computed(() => ({
  members: allMembers.value.filter(
    (m) => m.branchId === detail.value?.branch.id,
  ).length,
  classes: detail.value?.classes.length ?? 0,
  trainers: detail.value?.trainers.length ?? 0,
}));

const deleteBlocked = computed(
  () =>
    deleteBlockers.value.members +
      deleteBlockers.value.classes +
      deleteBlockers.value.trainers >
    0,
);

const deleteDescription = computed(() => {
  if (!detail.value) return '';
  const b = deleteBlockers.value;
  if (deleteBlocked.value) {
    const parts: string[] = [];
    if (b.members) parts.push(`${b.members} socio(s)`);
    if (b.classes) parts.push(`${b.classes} clase(s)`);
    if (b.trainers) parts.push(`${b.trainers} entrenador(es)`);
    return `'${detail.value.branch.name}' tiene ${parts.join(', ')} asignados — retíralos o reasígnalos antes de eliminar la sede.`;
  }
  return `Se eliminará la sede '${detail.value.branch.name}' del catálogo. Esta acción no se puede deshacer.`;
});

async function deleteBranch(): Promise<void> {
  if (!detail.value || deleting.value) return;
  deleting.value = true;
  try {
    await $fetch(`/api/branches/${detail.value.branch.id}`, {
      method: 'DELETE',
    });
    deleteModalOpen.value = false;
    await navigateTo('/sedes');
  } finally {
    deleting.value = false;
  }
}

async function assignTrainer(): Promise<void> {
  if (!detail.value || !assignTrainerId.value) return;
  await $fetch(`/api/trainers/${assignTrainerId.value}/update`, {
    method: 'POST',
    body: { addBranchId: detail.value.branch.id },
  });
  assignTrainerId.value = '';
  await load();
}

const trainerToRemove = ref<Trainer | null>(null);
const removeModalOpen = ref(false);
const removing = ref(false);

const removeDescription = computed(() => {
  if (!trainerToRemove.value || !detail.value) return '';
  const others = otherBranches(trainerToRemove.value);
  return others
    ? `${trainerToRemove.value.name} dejará de estar asignado a ${detail.value.branch.name}. Seguirá asignado a: ${others}.`
    : `${trainerToRemove.value.name} dejará de estar asignado a ${detail.value.branch.name} y quedará sin sedes asignadas.`;
});

function confirmRemoveTrainer(trainer: Trainer): void {
  trainerToRemove.value = trainer;
  removeModalOpen.value = true;
}

async function unassignTrainer(): Promise<void> {
  if (!detail.value || !trainerToRemove.value || removing.value) return;
  removing.value = true;
  try {
    await $fetch(`/api/trainers/${trainerToRemove.value.id}/update`, {
      method: 'POST',
      body: { removeBranchId: detail.value.branch.id },
    });
    removeModalOpen.value = false;
    trainerToRemove.value = null;
    await load();
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <div
    v-if="pending"
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cargando sede…
  </div>

  <div v-else-if="detail" class="space-y-6">
    <div class="flex items-center gap-4">
      <img
        :src="detail.branch.imageUrl"
        :alt="detail.branch.name"
        class="h-20 w-28 rounded-2xl border border-stroke object-cover"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-black text-text-primary">
          {{ detail.branch.name }}
        </h1>
        <p class="mt-1 truncate text-[11px] text-text-dim">
          {{ detail.branch.address }} · {{ hhmm(detail.branch.openMinutes) }} a
          {{ hhmm(detail.branch.closeMinutes) }}
        </p>
      </div>
      <span
        class="rounded-full border px-3 py-1 text-[11px] font-black"
        :class="
          detail.branch.status === 'OPEN'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
            : 'border-red-400/30 bg-red-400/10 text-red-400'
        "
      >
        {{ detail.branch.status === 'OPEN' ? 'ABIERTA' : 'CERRADA' }}
      </span>
    </div>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="flex items-center justify-between">
        <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Información de la sede
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
            Dirección
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.branch.address }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Horario de operación
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ hhmm(detail.branch.openMinutes) }} –
            {{ hhmm(detail.branch.closeMinutes) }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Aforo máximo
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.branch.maxCapacity }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Aforo actual
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.branch.currentCapacity }}
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
              Dirección
            </span>
            <input
              v-model="editForm.address"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <div class="col-span-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Imagen
            </span>
            <ImagePicker
              v-model="editForm.imageUrl"
              label="Subir imagen de la sede"
              compact
              class="mt-1"
            />
          </div>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Aforo máximo
            </span>
            <input
              v-model.number="editForm.maxCapacity"
              type="number"
              min="1"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Aforo actual
            </span>
            <input
              v-model.number="editForm.currentCapacity"
              type="number"
              min="0"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Apertura
            </span>
            <input
              v-model="editForm.openTime"
              type="time"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Cierre
            </span>
            <input
              v-model="editForm.closeTime"
              type="time"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-text-muted">
            Sede abierta al público
          </span>
          <button
            class="relative h-6 w-11 cursor-pointer rounded-full transition"
            :class="
              editForm.status === 'OPEN'
                ? 'bg-accent'
                : 'bg-base border border-stroke'
            "
            @click="
              editForm.status =
                editForm.status === 'OPEN' ? 'CLOSED' : 'OPEN'
            "
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              :class="editForm.status === 'OPEN' ? 'left-[22px]' : 'left-0.5'"
            />
          </button>
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
            class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-white transition hover:opacity-90 disabled:opacity-50"
            :disabled="saving"
            @click="
              confirmSave(
                'Guardar cambios de la sede',
                branchChanges,
                saveBranch,
              )
            "
          >
            <Check class="h-3.5 w-3.5" />
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Ocupación
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ Math.round(detail.stats.occupancy * 100) }}%
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Clases
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ detail.stats.classes }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          En turno
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ detail.stats.trainersOnDuty }}
        </p>
      </div>
    </div>

    <section>
      <h2 class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted">
        Entrenadores asignados
      </h2>
      <div class="space-y-3">
        <div
          v-for="trainer in detail.trainers"
          :key="trainer.id"
          class="flex items-center gap-3 rounded-2xl border border-stroke bg-surface p-4"
        >
          <button
            type="button"
            class="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
            title="Ver detalle del entrenador"
            @click="openTrainerDetail(trainer)"
          >
            <img
              :src="trainer.photoUrl"
              :alt="trainer.name"
              class="h-10 w-10 shrink-0 rounded-xl border border-stroke object-cover"
            />
            <div class="min-w-0">
              <p
                class="truncate text-xs font-bold text-text-primary transition group-hover:text-accent"
              >
                {{ trainer.name }}
              </p>
              <p class="truncate text-[10px] text-text-dim">
                {{ trainer.specialty }}
              </p>
              <p
                v-if="otherBranches(trainer)"
                class="truncate text-[9px] text-text-dim"
              >
                También en: {{ otherBranches(trainer) }}
              </p>
            </div>
          </button>
          <span
            class="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black"
            :class="
              trainer.isOnDuty
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                : 'border-stroke bg-base text-text-dim'
            "
          >
            {{ trainer.isOnDuty ? 'EN TURNO' : 'FUERA' }}
          </span>
          <button
            class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-red-400 hover:text-red-400"
            title="Quitar de esta sede"
            @click="confirmRemoveTrainer(trainer)"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </div>
      <p
        v-if="detail.trainers.length === 0"
        class="py-4 text-center text-xs font-semibold text-text-dim"
      >
        Sin entrenadores asignados
      </p>

      <div class="mt-4 flex items-center gap-3">
        <USelectMenu
          v-model="assignTrainerId"
          :items="availableTrainerItems"
          value-key="value"
          placeholder="Asignar entrenador a esta sede…"
          class="flex-1"
        />
        <button
          class="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-white transition hover:opacity-90 disabled:opacity-40"
          :disabled="!assignTrainerId"
          @click="assignTrainer"
        >
          <UserPlus class="h-3.5 w-3.5" />
          Asignar
        </button>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted">
        Clases y horarios
      </h2>
      <div class="space-y-3">
        <div
          v-for="gymClass in detail.classes"
          :key="gymClass.id"
          class="rounded-2xl border border-stroke bg-surface p-4"
        >
          <div
            v-if="editingClassId === gymClass.id"
            class="space-y-3"
          >
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">Nombre</span>
                <input
                  v-model="classForm.name"
                  type="text"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label class="block">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">Coach</span>
                <USelectMenu
                  v-model="classForm.coach"
                  :items="coachItems"
                  value-key="value"
                  class="mt-1 w-full"
                />
              </label>
              <label class="block">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">Sala</span>
                <input
                  v-model="classForm.room"
                  type="text"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label class="block">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">Capacidad</span>
                <input
                  v-model.number="classForm.capacity"
                  type="number"
                  min="1"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label class="block">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">Inicio</span>
                <input
                  v-model="classForm.start"
                  type="time"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label class="block">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">Fin</span>
                <input
                  v-model="classForm.end"
                  type="time"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
            </div>
            <div class="flex justify-end gap-2">
              <button
                class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 text-[11px] font-black text-text-muted transition hover:text-text-primary"
                @click="editingClassId = null"
              >
                <X class="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-white transition hover:opacity-90"
                :disabled="saving"
                @click="
                  confirmSave(
                    'Guardar cambios de la clase',
                    classChanges,
                    saveClass,
                  )
                "
              >
                <Check class="h-3.5 w-3.5" />
                Guardar
              </button>
            </div>
          </div>

          <div v-else class="flex items-center gap-3">
            <button
              type="button"
              class="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              title="Ver detalle de la clase"
              @click="openClassDetail(gymClass)"
            >
              <div
                class="shrink-0 rounded-xl border border-stroke bg-base px-2.5 py-1.5 text-center"
              >
                <p class="font-mono text-[11px] font-black text-accent">
                  {{ hhmm(gymClass.startMinutes) }}
                </p>
                <p class="font-mono text-[9px] text-text-dim">
                  {{ hhmm(gymClass.endMinutes) }}
                </p>
              </div>
              <div class="min-w-0">
                <p
                  class="truncate text-xs font-bold text-text-primary transition group-hover:text-accent"
                >
                  {{ gymClass.name }}
                </p>
                <p class="truncate text-[10px] text-text-dim">
                  {{ gymClass.coach }} · {{ gymClass.room }} ·
                  {{ classDuration(gymClass) }}
                </p>
              </div>
            </button>
            <span class="shrink-0 text-[11px] font-bold text-text-dim">
              {{ gymClass.booked }}/{{ gymClass.capacity }} cupos
            </span>
            <button
              class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent"
              title="Editar clase"
              @click.stop="startEditClass(gymClass)"
            >
              <Pencil class="h-3 w-3" />
            </button>
            <button
              class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke text-red-400 transition hover:border-red-400"
              title="Quitar de esta sede"
              @click.stop="confirmRemoveClass(gymClass)"
            >
              <X class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <p
        v-if="detail.classes.length === 0"
        class="mt-3 py-4 text-center text-xs font-semibold text-text-dim"
      >
        Sin clases en esta sede
      </p>

      <div class="mt-4 flex items-center gap-3">
        <USelectMenu
          v-model="assignClassId"
          :items="availableClassItems"
          value-key="value"
          placeholder="Asignar clase existente a esta sede…"
          class="flex-1"
        />
        <button
          class="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-white transition hover:opacity-90 disabled:opacity-40"
          :disabled="!assignClassId"
          @click="assignClass"
        >
          <Plus class="h-3.5 w-3.5" />
          Asignar
        </button>
      </div>
    </section>

    <UModal
      v-model:open="saveModalOpen"
      :title="saveModalTitle"
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
      v-model:open="trainerDetailOpen"
      :title="selectedTrainer?.name ?? 'Detalle del entrenador'"
      description="Entrenador asignado a esta sede."
    >
      <template #body>
        <div v-if="selectedTrainer" class="space-y-4">
          <div class="flex items-center gap-4">
            <img
              :src="selectedTrainer.photoUrl"
              :alt="selectedTrainer.name"
              class="h-16 w-16 rounded-2xl border border-stroke object-cover"
            />
            <div class="min-w-0">
              <p class="text-sm font-black text-text-primary">
                {{ selectedTrainer.specialty }}
              </p>
              <p class="mt-0.5 text-[11px] text-text-dim">
                Turno {{ selectedTrainer.shift.toLowerCase() }}
              </p>
              <span
                class="mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                :class="
                  selectedTrainer.isOnDuty
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                    : 'border-stroke bg-base text-text-dim'
                "
              >
                {{ selectedTrainer.isOnDuty ? 'EN TURNO AHORA' : 'FUERA DE TURNO' }}
              </span>
            </div>
          </div>
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Sedes asignadas
            </p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="name in selectedTrainerBranches"
                :key="name"
                class="rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                :class="
                  name === detail.branch.name
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-stroke bg-base text-text-muted'
                "
              >
                {{ name }}
              </span>
            </div>
          </div>
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Clases que imparte en esta sede
            </p>
            <div v-if="selectedTrainerClasses.length" class="space-y-1.5">
              <div
                v-for="c in selectedTrainerClasses"
                :key="c.id"
                class="flex items-center justify-between rounded-xl border border-stroke bg-base px-3 py-2"
              >
                <p class="text-[11px] font-bold text-text-primary">
                  {{ c.name }}
                  <span class="font-semibold text-text-dim">· {{ c.room }}</span>
                </p>
                <p class="font-mono text-[10px] text-text-dim">
                  {{ hhmm(c.startMinutes) }}–{{ hhmm(c.endMinutes) }}
                </p>
              </div>
            </div>
            <p v-else class="text-[11px] text-text-dim">
              Sin clases asignadas en esta sede
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton
            label="Ver ficha completa"
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-right"
            trailing
            @click="
              trainerDetailOpen = false;
              navigateTo(`/entrenadores/${selectedTrainer?.id}`);
            "
          />
          <UButton
            label="Quitar de la sede"
            color="error"
            variant="soft"
            icon="i-lucide-x"
            @click="askRemoveSelectedTrainer"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeModalOpen"
      title="Quitar entrenador de la sede"
      :description="removeDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="removeModalOpen = false"
          />
          <UButton
            label="Quitar de la sede"
            color="error"
            :loading="removing"
            @click="unassignTrainer"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="classDetailOpen"
      :title="selectedClass?.name ?? 'Detalle de clase'"
      description="Actividad que se imparte en esta sede."
    >
      <template #body>
        <div v-if="selectedClass" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Horario
              </p>
              <p class="mt-1 text-sm font-black text-text-primary">
                {{ hhmm(selectedClass.startMinutes) }} –
                {{ hhmm(selectedClass.endMinutes) }}
                <span class="text-[10px] font-semibold text-text-dim">
                  ({{ classDuration(selectedClass) }})
                </span>
              </p>
            </div>
            <div>
              <p
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Coach
              </p>
              <p class="mt-1 text-sm font-black text-text-primary">
                {{ selectedClass.coach }}
              </p>
            </div>
            <div>
              <p
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Sala
              </p>
              <p class="mt-1 text-sm font-black text-text-primary">
                {{ selectedClass.room }}
              </p>
            </div>
            <div>
              <p
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Ocupación
              </p>
              <div class="mt-1.5 flex items-center gap-2">
                <div
                  class="h-1.5 flex-1 overflow-hidden rounded-full bg-base"
                >
                  <div
                    class="h-full rounded-full transition-all"
                    :class="
                      classFill(selectedClass) >= 1
                        ? 'bg-red-400'
                        : classFill(selectedClass) >= 0.7
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                    "
                    :style="{ width: `${classFill(selectedClass) * 100}%` }"
                  />
                </div>
                <span class="text-[11px] font-black text-text-primary">
                  {{ selectedClass.booked }}/{{ selectedClass.capacity }}
                </span>
              </div>
              <p class="mt-0.5 text-[9px] font-semibold text-text-dim">
                {{
                  classFill(selectedClass) >= 1
                    ? 'Clase llena'
                    : `${selectedClass.capacity - selectedClass.booked} cupos disponibles`
                }}
              </p>
            </div>
          </div>
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Se imparte en
            </p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="name in selectedClassBranches"
                :key="name"
                class="rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                :class="
                  name === detail.branch.name
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-stroke bg-base text-text-muted'
                "
              >
                {{ name }}
              </span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton
            label="Ver ficha completa"
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-right"
            trailing
            @click="
              classDetailOpen = false;
              navigateTo(`/clases/${selectedClass?.id}`);
            "
          />
          <UButton
            label="Editar clase"
            icon="i-lucide-pencil"
            @click="editSelectedClass"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeClassModalOpen"
      title="Quitar clase de la sede"
      :description="removeClassDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="removeClassModalOpen = false"
          />
          <UButton
            label="Quitar de la sede"
            color="error"
            :loading="removingClass"
            @click="removeClass"
          />
        </div>
      </template>
    </UModal>

    <button
      class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-400/40 bg-red-400/10 text-xs font-black text-red-400 transition hover:bg-red-400/20"
      @click="deleteModalOpen = true"
    >
      <Trash2 class="h-4 w-4" />
      Eliminar sede
    </button>

    <UModal
      v-model:open="deleteModalOpen"
      title="Eliminar sede"
      :description="deleteDescription"
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
            label="Eliminar sede"
            color="error"
            :disabled="deleteBlocked"
            :loading="deleting"
            @click="deleteBranch"
          />
        </div>
      </template>
    </UModal>

    <NuxtLink
      to="/sedes"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Sedes
    </NuxtLink>
  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Sede no encontrada
  </div>
</template>
