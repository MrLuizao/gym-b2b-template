<script setup lang="ts">
import {
  Activity,
  DoorClosed,
  DoorOpen,
  Layers,
  MapPin,
  Plus,
} from '@lucide/vue';

import type { Branch, ClassSchedule } from '#shared/types';

const { session, canEditBranch } = useAuth();
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const branches = ref<Branch[]>([]);
const classes = ref<ClassSchedule[]>([]);
const pending = ref(true);

const branchFilter = ref<'todas' | 'OPEN' | 'CLOSED' | 'busy'>('todas');

const createModalOpen = ref(false);
const creating = ref(false);
const createError = ref<string | null>(null);

const createForm = ref({
  name: '',
  address: '',
  lat: '',
  lng: '',
  imageUrl: '',
  maxCapacity: 100,
  openTime: '06:00',
  closeTime: '22:00',
  status: 'OPEN' as Branch['status'],
});

function parseCoord(raw: string): number | null {
  const value = Number(raw.trim());
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
}

const confirmOpen = ref(false);
const confirmTitle = ref('');
const confirmDescription = ref('');
const confirmAction = ref<(() => Promise<void>) | null>(null);
const confirming = ref(false);

onMounted(async () => {
  try {
    const [branchList, classList] = await Promise.all([
      $fetch<Branch[]>('/api/branches'),
      $fetch<ClassSchedule[]>('/api/classes'),
    ]);
    branches.value = branchList;
    classes.value = classList;
  } finally {
    pending.value = false;
  }
});

const openCount = computed(
  () => branches.value.filter((b) => b.status === 'OPEN').length,
);

const totalCurrent = computed(() =>
  branches.value.reduce((sum, b) => sum + b.currentCapacity, 0),
);

const globalOccupancy = computed(() => {
  const max = branches.value.reduce((sum, b) => sum + b.maxCapacity, 0);
  return max > 0 ? Math.round((totalCurrent.value / max) * 100) : 0;
});

const busyCount = computed(
  () => branches.value.filter((b) => occupancy(b) > 0.8).length,
);

const closedCount = computed(
  () => branches.value.filter((b) => b.status === 'CLOSED').length,
);

const filteredBranches = computed(() => {
  switch (branchFilter.value) {
    case 'OPEN':
      return branches.value.filter((b) => b.status === 'OPEN');
    case 'CLOSED':
      return branches.value.filter((b) => b.status === 'CLOSED');
    case 'busy':
      return branches.value.filter((b) => occupancy(b) > 0.8);
    default:
      return branches.value;
  }
});

function toggleBranchFilter(
  key: 'todas' | 'OPEN' | 'CLOSED' | 'busy',
): void {
  branchFilter.value = branchFilter.value === key ? 'todas' : key;
}

function occupancy(branch: Branch): number {
  return branch.maxCapacity > 0
    ? branch.currentCapacity / branch.maxCapacity
    : 0;
}

function barColor(ratio: number): string {
  if (ratio < 0.5) return 'bg-emerald-400';
  if (ratio <= 0.8) return 'bg-amber-400';
  return 'bg-red-400';
}

function occupancyCls(ratio: number): string {
  if (ratio < 0.5)
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400';
  if (ratio <= 0.8)
    return 'border-amber-400/30 bg-amber-400/10 text-amber-400';
  return 'border-red-400/30 bg-red-400/10 text-red-400';
}

function classesAt(branchId: string): number {
  return classes.value.filter((c) => c.branchIds.includes(branchId)).length;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
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

function toggleBranchStatus(branch: Branch): void {
  const next: Branch['status'] =
    branch.status === 'OPEN' ? 'CLOSED' : 'OPEN';
  askConfirm(
    next === 'CLOSED'
      ? `Cerrar la sede ${branch.name}`
      : `Abrir la sede ${branch.name}`,
    next === 'CLOSED'
      ? 'La sede se cerrará al público — los socios no podrán hacer check-in hasta reabrirla.'
      : 'La sede se abrirá al público y los socios podrán hacer check-in.',
    async () => {
      const updated = await $fetch<Branch>(`/api/branches/${branch.id}`, {
        method: 'PUT',
        body: { status: next },
      });
      const index = branches.value.findIndex((b) => b.id === branch.id);
      if (index !== -1) branches.value[index] = updated;
    },
  );
}

function submitBranch(): void {
  if (createForm.value.name.trim().length < 3) {
    createError.value = 'El nombre es obligatorio (mín. 3 caracteres)';
    return;
  }
  if (createForm.value.maxCapacity < 1) {
    createError.value = 'El aforo máximo debe ser al menos 1';
    return;
  }
  createError.value = null;
  askConfirm(
    'Crear sede',
    `Se creará la sede "${createForm.value.name.trim()}" con aforo máximo ${createForm.value.maxCapacity} y horario ${createForm.value.openTime}–${createForm.value.closeTime}. ${createForm.value.status === 'OPEN' ? 'Quedará abierta al público.' : 'Quedará cerrada hasta que se active.'}`,
    async () => {
      creating.value = true;
      try {
        const branch = await $fetch<Branch>('/api/branches', {
          method: 'POST',
          body: {
            ...createForm.value,
            name: createForm.value.name.trim(),
            lat: parseCoord(createForm.value.lat),
            lng: parseCoord(createForm.value.lng),
          },
        });
        branches.value.push(branch);
        createForm.value = {
          name: '',
          address: '',
          lat: '',
          lng: '',
          imageUrl: '',
          maxCapacity: 100,
          openTime: '06:00',
          closeTime: '22:00',
          status: 'OPEN',
        };
        createModalOpen.value = false;
      } catch (cause) {
        createError.value =
          cause instanceof Error ? cause.message : 'No se pudo crear la sede';
      } finally {
        creating.value = false;
      }
    },
  );
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          branchFilter === 'todas'
            ? 'border-accent bg-accent/10'
            : 'border-stroke bg-surface hover:border-accent/50'
        "
        @click="toggleBranchFilter('todas')"
      >
        <div class="flex items-center gap-2">
          <Layers class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Todas las sedes
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ branches.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          {{ totalCurrent }} personas · {{ globalOccupancy }}% aforo
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          branchFilter === 'OPEN'
            ? 'border-emerald-400 bg-emerald-400/10'
            : 'border-stroke bg-surface hover:border-emerald-400/50'
        "
        @click="toggleBranchFilter('OPEN')"
      >
        <div class="flex items-center gap-2">
          <DoorOpen class="h-4 w-4 text-emerald-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Abiertas
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-emerald-400">
          {{ openCount }}
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          branchFilter === 'CLOSED'
            ? 'border-red-400 bg-red-400/10'
            : 'border-stroke bg-surface hover:border-red-400/50'
        "
        @click="toggleBranchFilter('CLOSED')"
      >
        <div class="flex items-center gap-2">
          <DoorClosed class="h-4 w-4 text-red-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Cerradas
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-red-400">
          {{ closedCount }}
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          branchFilter === 'busy'
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-stroke bg-surface hover:border-amber-400/50'
        "
        @click="toggleBranchFilter('busy')"
      >
        <div class="flex items-center gap-2">
          <Activity class="h-4 w-4 text-amber-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Ocupación alta
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-amber-400">
          {{ busyCount }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          &gt;80% de aforo
        </p>
      </button>
    </div>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Sedes
        </h2>
        <button
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
          @click="createModalOpen = true"
        >
          <Plus class="h-3.5 w-3.5" />
          Nueva sede
        </button>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Sede</th>
              <th class="px-5 py-3 font-bold">Estado</th>
              <th class="px-5 py-3 font-bold">Horario</th>
              <th class="px-5 py-3 font-bold">Clases</th>
              <th class="px-5 py-3 font-bold">Aforo</th>
              <th class="px-5 py-3 font-bold">Ocupación</th>
              <th class="px-5 py-3 text-right font-bold">Activa</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="branch in filteredBranches"
              :key="branch.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <img
                    :src="branch.imageUrl"
                    :alt="branch.name"
                    class="h-10 w-16 rounded-lg border border-stroke object-cover"
                  />
                  <div class="min-w-0">
                    <button
                      class="cursor-pointer text-xs font-black text-text-primary transition hover:text-accent hover:underline"
                      @click="navigateTo(`/sedes/${branch.id}`)"
                    >
                      {{ branch.name }}
                    </button>
                    <p
                      class="mt-0.5 flex items-center gap-1 truncate text-[10px] text-text-dim"
                    >
                      <MapPin class="h-3 w-3 shrink-0" />
                      {{ branch.address }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3">
                <span class="flex items-center gap-1.5">
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="
                      branch.status === 'OPEN' ? 'bg-emerald-400' : 'bg-red-400'
                    "
                  />
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest"
                    :class="
                      branch.status === 'OPEN'
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    "
                  >
                    {{ branch.status === 'OPEN' ? 'Abierta' : 'Cerrada' }}
                  </span>
                </span>
              </td>
              <td class="px-5 py-3 font-mono text-[11px] text-text-muted">
                {{ toTime(branch.openMinutes) }}–{{ toTime(branch.closeMinutes) }}
              </td>
              <td class="px-5 py-3 text-sm font-bold text-text-primary">
                {{ classesAt(branch.id) }}
              </td>
              <td class="px-5 py-3">
                <p class="text-[11px] font-bold text-text-primary">
                  {{ branch.currentCapacity }}/{{ branch.maxCapacity }}
                </p>
                <div
                  class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-base"
                >
                  <div
                    class="h-full rounded-full"
                    :class="barColor(occupancy(branch))"
                    :style="{
                      width: `${Math.min(100, Math.round(occupancy(branch) * 100))}%`,
                    }"
                  />
                </div>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                  :class="occupancyCls(occupancy(branch))"
                >
                  {{ Math.round(occupancy(branch) * 100) }}%
                </span>
              </td>
              <td class="px-5 py-3 text-right">
                <button
                  :disabled="!canEditBranch(branch.id)"
                  class="relative inline-flex h-6 w-11 rounded-full align-middle transition disabled:cursor-not-allowed disabled:opacity-50"
                  :class="
                    branch.status === 'OPEN'
                      ? 'bg-accent'
                      : 'bg-base border border-stroke'
                  "
                  :title="
                    canEditBranch(branch.id)
                      ? branch.status === 'OPEN'
                        ? 'Cerrar sede'
                        : 'Abrir sede'
                      : 'Solo el admin o el gerente de esta sede'
                  "
                  @click="canEditBranch(branch.id) && toggleBranchStatus(branch)"
                >
                  <span
                    class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                    :class="
                      branch.status === 'OPEN'
                        ? 'left-[22px] bg-base'
                        : 'left-0.5 bg-white'
                    "
                  />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!pending && filteredBranches.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          {{
            branchFilter === 'todas'
              ? 'Sin sedes registradas'
              : 'Sin sedes en este filtro'
          }}
        </p>
      </div>
    </section>

    <UModal
      v-model:open="createModalOpen"
      title="Nueva sede"
      description="Se agregará al catálogo y quedará disponible para asignar clases, entrenadores y socios."
    >
      <template #body>
        <form class="space-y-3" @submit.prevent="submitBranch()">
          <input
            v-model="createForm.name"
            type="text"
            placeholder="Nombre de la sede"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <input
            v-model="createForm.address"
            type="text"
            placeholder="Dirección"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <div class="grid grid-cols-2 gap-3">
            <input
              v-model="createForm.lat"
              type="text"
              inputmode="decimal"
              placeholder="Latitud (ej. 19.2926)"
              class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
            <input
              v-model="createForm.lng"
              type="text"
              inputmode="decimal"
              placeholder="Longitud (ej. -99.6572)"
              class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
          </div>
          <ImagePicker
            v-model="createForm.imageUrl"
            label="Subir imagen de la sede (opcional)"
            @error="createError = $event"
          />
          <div class="grid grid-cols-3 gap-3">
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Aforo máx.
              </span>
              <input
                v-model.number="createForm.maxCapacity"
                type="number"
                min="1"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Abre
              </span>
              <input
                v-model="createForm.openTime"
                type="time"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >
                Cierra
              </span>
              <input
                v-model="createForm.closeTime"
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
              type="button"
              class="relative h-6 w-11 cursor-pointer rounded-full transition"
              :class="
                createForm.status === 'OPEN'
                  ? 'bg-accent'
                  : 'bg-base border border-stroke'
              "
              @click="
                createForm.status =
                  createForm.status === 'OPEN' ? 'CLOSED' : 'OPEN'
              "
            >
              <span
                class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                :class="
                  createForm.status === 'OPEN'
                    ? 'left-[22px] bg-base'
                    : 'left-0.5 bg-white'
                "
              />
            </button>
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
            label="Crear sede"
            icon="i-lucide-plus"
            :loading="creating"
            @click="submitBranch"
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
