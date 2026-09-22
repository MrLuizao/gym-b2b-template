<script setup lang="ts">
import { ArrowLeft, Check, Pencil, X } from '@lucide/vue';

import type { Branch, ClassSchedule, TrainerDetail } from '#shared/types';

const route = useRoute();
const { session, canEditInBranches, isAtMyBranch } = useAuth();
const isAdmin = computed(() => session.value?.role === 'ADMIN');
const canViewBranches = computed(() =>
  canAccess(session.value?.role, '/sedes'),
);
const detail = ref<TrainerDetail | null>(null);
const branches = ref<Branch[]>([]);
const pending = ref(true);
const saving = ref(false);

const editing = ref(false);
const editForm = ref({
  name: '',
  specialty: '',
  shift: 'TARDE',
  branchIds: [] as string[],
});

const shiftItems = [
  { label: 'MAÑANA', value: 'MAÑANA' },
  { label: 'TARDE', value: 'TARDE' },
  { label: 'NOCHE', value: 'NOCHE' },
];

/// Admin edita cualquier coach; gerente solo los asignados a su sede.
const canManageTrainer = computed(() =>
  detail.value ? canEditInBranches(detail.value.trainer.branchIds) : false,
);

/// El gerente solo puede asignar/quitar el coach en su propia sede.
const branchItems = computed(() =>
  branches.value
    .filter((b) => canEditInBranches([b.id]))
    .map((b) => ({ label: b.name, value: b.id })),
);

const editingClassId = ref<string | null>(null);
const classForm = ref({
  name: '',
  room: '',
  start: '06:00',
  end: '07:00',
  capacity: 20,
  booked: 0,
});

onMounted(async () => {
  try {
    const [branchList, trainerDetail] = await Promise.all([
      $fetch<Branch[]>('/api/branches'),
      $fetch<TrainerDetail>(`/api/trainers/${route.params.id}`),
    ]);
    branches.value = branchList;
    detail.value = trainerDetail;
  } finally {
    pending.value = false;
  }
});

const trainer = computed(() => detail.value?.trainer ?? null);

const editingClass = computed(
  () =>
    detail.value?.classes.find((c) => c.id === editingClassId.value) ?? null,
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

const trainerChanges = computed<string[]>(() => {
  const t = detail.value?.trainer;
  if (!t) return [];
  const changes: string[] = [];
  if (editForm.value.name !== t.name)
    changes.push(
      `Nombre: '${t.name}' → '${editForm.value.name}' — sus clases pasarán a mostrar el nuevo nombre de coach`,
    );
  if (editForm.value.specialty !== t.specialty)
    changes.push('Se actualizará la especialidad');
  if (editForm.value.shift !== t.shift)
    changes.push(`Turno: ${t.shift} → ${editForm.value.shift}`);
  const before = [...t.branchIds].sort().join(',');
  const after = [...editForm.value.branchIds].sort().join(',');
  if (before !== after) {
    const names = editForm.value.branchIds.map(branchName).join(', ');
    changes.push(
      names
        ? `Quedará asignado a: ${names}`
        : 'Quedará sin sedes asignadas',
    );
  }
  return changes;
});

const classChanges = computed<string[]>(() => {
  const c = editingClass.value;
  if (!c) return [];
  const changes: string[] = [];
  if (classForm.value.name !== c.name)
    changes.push(`Nombre: '${c.name}' → '${classForm.value.name}'`);
  const local = classBaseline(c);
  if (classForm.value.room !== local.room)
    changes.push(`Sala: ${local.room} → ${classForm.value.room}`);
  if (
    toMinutes(classForm.value.start) !== local.startMinutes ||
    toMinutes(classForm.value.end) !== local.endMinutes
  )
    changes.push(
      `Horario: ${hhmm(local.startMinutes)}–${hhmm(local.endMinutes)} → ${classForm.value.start}–${classForm.value.end}`,
    );
  if (classForm.value.capacity !== c.capacity)
    changes.push(`Capacidad: ${c.capacity} → ${classForm.value.capacity}`);
  if (classForm.value.booked !== c.booked)
    changes.push(`Inscritos: ${c.booked} → ${classForm.value.booked}`);
  if (classForm.value.booked > classForm.value.capacity)
    changes.push('Los inscritos exceden la capacidad — se ajustarán al máximo');
  return changes;
});

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? '—';
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

function occupancy(gymClass: { booked: number; capacity: number }): number {
  return gymClass.capacity > 0 ? gymClass.booked / gymClass.capacity : 0;
}

function barColor(ratio: number): string {
  if (ratio < 0.5) return 'bg-emerald-400';
  if (ratio <= 0.8) return 'bg-amber-400';
  return 'bg-red-400';
}

function startEdit(): void {
  if (!detail.value) return;
  editForm.value = {
    name: detail.value.trainer.name,
    specialty: detail.value.trainer.specialty,
    shift: detail.value.trainer.shift,
    branchIds: [...detail.value.trainer.branchIds],
  };
  editing.value = true;
}

async function saveTrainer(): Promise<void> {
  if (!detail.value || saving.value) return;
  saving.value = true;
  try {
    const updated = await $fetch<{ isOnDuty: boolean } & Record<string, unknown>>(
      `/api/trainers/${detail.value.trainer.id}/update`,
      { method: 'POST', body: editForm.value },
    );
    detail.value = {
      ...detail.value,
      trainer: { ...detail.value.trainer, ...updated } as TrainerDetail['trainer'],
    };
    editing.value = false;
  } finally {
    saving.value = false;
  }
}

/// Valores de horario/sala que edita cada rol: admin toca los base;
/// gerente los de su propia sede (override local).
function classBaseline(c: ClassSchedule) {
  return classTimeAt(c, isAdmin.value ? null : session.value?.branchId);
}

function startEditClass(gymClass: ClassSchedule): void {
  const local = classBaseline(gymClass);
  editingClassId.value = gymClass.id;
  classForm.value = {
    name: gymClass.name,
    room: local.room,
    start: hhmm(local.startMinutes),
    end: hhmm(local.endMinutes),
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
        body: isAdmin.value
          ? {
              name: classForm.value.name,
              room: classForm.value.room,
              startMinutes: toMinutes(classForm.value.start),
              endMinutes: toMinutes(classForm.value.end),
              capacity: classForm.value.capacity,
              booked: classForm.value.booked,
            }
          : {
              /// El gerente solo escribe el horario/sala de su propia sede.
              branchTime: {
                branchId: session.value?.branchId,
                startMinutes: toMinutes(classForm.value.start),
                endMinutes: toMinutes(classForm.value.end),
                room: classForm.value.room,
              },
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

const dutyModalOpen = ref(false);
const togglingDuty = ref(false);

const dutyDescription = computed(() => {
  const t = detail.value?.trainer;
  if (!t) return '';
  return t.isOnDuty
    ? `${t.name} se marcará como fuera de turno y dejará de aparecer como disponible en la app.`
    : `${t.name} se marcará en turno y aparecerá como disponible en la app.`;
});

async function runToggleDuty(): Promise<void> {
  if (!detail.value || togglingDuty.value) return;
  togglingDuty.value = true;
  try {
    const updated = await $fetch<{ isOnDuty: boolean }>(
      `/api/trainers/${detail.value.trainer.id}/duty`,
      { method: 'POST' },
    );
    detail.value = {
      ...detail.value,
      trainer: { ...detail.value.trainer, isOnDuty: updated.isOnDuty },
    };
    dutyModalOpen.value = false;
  } finally {
    togglingDuty.value = false;
  }
}
</script>

<template>
  <div
    v-if="pending"
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cargando entrenador…
  </div>

  <div v-else-if="detail" class="space-y-6">
    <div class="flex items-center gap-4">
      <img
        :src="detail.trainer.photoUrl"
        :alt="detail.trainer.name"
        class="h-20 w-20 rounded-2xl border border-stroke object-cover"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-black text-text-primary">
          {{ detail.trainer.name }}
        </h1>
        <p class="mt-1 text-[11px] text-text-dim">
          {{ detail.trainer.specialty }}
        </p>
      </div>
      <span
        class="rounded-full border px-3 py-1 text-[11px] font-black"
        :class="
          detail.trainer.shift === 'MAÑANA'
            ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
            : detail.trainer.shift === 'NOCHE'
              ? 'border-violet-400/30 bg-violet-400/10 text-violet-400'
              : 'border-accent/30 bg-accent/10 text-accent'
        "
      >
        {{ detail.trainer.shift }}
      </span>
    </div>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="flex items-center justify-between">
        <h2
          class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
        >
          Información
        </h2>
        <button
          v-if="!editing && canManageTrainer"
          class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent"
          @click="startEdit"
        >
          <Pencil class="h-3 w-3" />
          Editar
        </button>
      </div>

      <div v-if="!editing" class="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Especialidad
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.trainer.specialty }}
          </p>
        </div>
        <div>
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Sedes
          </p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <button
              v-for="bid in detail.trainer.branchIds"
              :key="bid"
              type="button"
              :disabled="!canViewBranches"
              class="rounded-full border border-stroke bg-base px-2.5 py-0.5 text-[10px] font-bold text-text-muted transition"
              :class="
                canViewBranches
                  ? 'cursor-pointer hover:border-accent hover:text-accent'
                  : 'cursor-default'
              "
              @click="canViewBranches && navigateTo(`/sedes/${bid}`)"
            >
              {{ branchName(bid) }}
            </button>
            <span
              v-if="detail.trainer.branchIds.length === 0"
              class="text-sm font-black text-text-primary"
            >
              —
            </span>
          </div>
        </div>
        <div>
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            En turno
          </p>
          <button
            :disabled="!isAtMyBranch(detail.trainer.branchIds)"
            class="relative mt-1 h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              detail.trainer.isOnDuty
                ? 'bg-accent'
                : 'bg-base border border-stroke'
            "
            @click="
              isAtMyBranch(detail.trainer.branchIds) && (dutyModalOpen = true)
            "
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="
                detail.trainer.isOnDuty
                  ? 'left-[22px] bg-base'
                  : 'left-0.5 bg-white'
              "
            />
          </button>
        </div>
      </div>

      <div v-else class="mt-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Nombre
            </span>
            <input
              v-model="editForm.name"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Especialidad
            </span>
            <input
              v-model="editForm.specialty"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Turno
            </span>
            <USelectMenu
              v-model="editForm.shift"
              :items="shiftItems"
              value-key="value"
              class="mt-1 w-full"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
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
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button
            class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-4 text-[11px] font-black text-text-muted transition hover:text-text-primary"
            @click="editing = false"
          >
            <X class="h-3.5 w-3.5" />
            Cancelar
          </button>
          <button
            class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-base transition hover:opacity-90 disabled:opacity-50"
            :disabled="saving"
            @click="
              confirmSave(
                'Guardar cambios del entrenador',
                trainerChanges,
                saveTrainer,
              )
            "
          >
            <Check class="h-3.5 w-3.5" />
            Guardar
          </button>
        </div>
      </div>
    </section>

    <section>
      <h2
        class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
      >
        Clases asignadas
      </h2>
      <div class="space-y-3">
        <div
          v-for="gymClass in detail.classes"
          :key="gymClass.id"
          class="rounded-2xl border border-stroke bg-surface p-4"
        >
          <template v-if="editingClassId === gymClass.id">
            <p v-if="!isAdmin" class="mb-2 text-[11px] font-semibold text-text-dim">
              Solo puedes ajustar el horario y la sala de tu sede.
            </p>
            <div class="grid grid-cols-2 gap-3">
              <label v-if="isAdmin" class="block">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >
                  Nombre
                </span>
                <input
                  v-model="classForm.name"
                  type="text"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label class="block">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >
                  Sala{{ isAdmin ? '' : ' (mi sede)' }}
                </span>
                <input
                  v-model="classForm.room"
                  type="text"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label class="block">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >
                  Inicio
                </span>
                <input
                  v-model="classForm.start"
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
                  v-model="classForm.end"
                  type="time"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label v-if="isAdmin" class="block">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >
                  Capacidad
                </span>
                <input
                  v-model.number="classForm.capacity"
                  type="number"
                  min="1"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label v-if="isAdmin" class="block">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >
                  Inscritos
                </span>
                <input
                  v-model.number="classForm.booked"
                  type="number"
                  min="0"
                  class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
            </div>
            <div class="mt-3 flex justify-end gap-2">
              <button
                class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 text-[11px] font-black text-text-muted transition hover:text-text-primary"
                @click="editingClassId = null"
              >
                <X class="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-base transition hover:opacity-90"
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
          </template>

          <template v-else>
            <div class="flex items-center gap-3">
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
                  {{
                    gymClass.branchIds.map(branchName).join(' · ')
                  }}
                  · {{ gymClass.room }}
                </p>
              </div>
              <div class="w-28">
                <div
                  class="flex items-center justify-between text-[10px] font-bold text-text-dim"
                >
                  <span>{{ gymClass.booked }}/{{ gymClass.capacity }}</span>
                  <span>
                    {{
                      Math.round(
                        (gymClass.booked / Math.max(1, gymClass.capacity)) *
                          100,
                      )
                    }}%
                  </span>
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
              <button
                v-if="isAtMyBranch(gymClass.branchIds)"
                class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent"
                title="Editar clase"
                @click="startEditClass(gymClass)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
            </div>
          </template>
        </div>
      </div>
      <p
        v-if="detail.classes.length === 0"
        class="py-6 text-center text-xs font-semibold text-text-dim"
      >
        Sin clases asignadas
      </p>
    </section>

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
              detail.trainer.isOnDuty
                ? 'Marcar fuera de turno'
                : 'Marcar en turno'
            "
            :color="detail.trainer.isOnDuty ? 'warning' : 'primary'"
            :loading="togglingDuty"
            @click="runToggleDuty"
          />
        </div>
      </template>
    </UModal>

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

    <NuxtLink
      to="/entrenadores"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Entrenadores
    </NuxtLink>
  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Entrenador no encontrado
  </div>
</template>
