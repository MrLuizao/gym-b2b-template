<script setup lang="ts">
import { ArrowLeft, Lock, UserPlus } from '@lucide/vue';

import { COACH_AVATAR_IDS } from '#shared/coach-avatars';
import type { Branch, Trainer } from '#shared/types';

const router = useRouter();
const { session } = useAuth();
const isAdmin = computed(() => session.value?.role === 'ADMIN');
/// Alta de coach: admin y gerente (la recepción no gestiona personal).
const canCreateTrainer = computed(
  () => session.value?.role === 'ADMIN' || session.value?.role === 'MANAGER',
);

const branches = ref<Branch[]>([]);
const saving = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);

const form = ref({
  firstName: '',
  middleName: '',
  paternalLastName: '',
  maternalLastName: '',
  specialty: '',
  shift: 'TARDE' as Trainer['shift'],
  branchIds: session.value?.branchId ? [session.value.branchId] : [],
  avatar: COACH_AVATAR_IDS[0] as string,
});

const shiftOptions: Trainer['shift'][] = ['MAÑANA', 'TARDE', 'NOCHE'];

const lockedBranchName = computed(
  () =>
    branches.value.find((b) => b.id === session.value?.branchId)?.name ??
    session.value?.branchName ??
    '',
);

function branchName(id: string): string {
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

function toggleBranch(branchId: string): void {
  const ids = form.value.branchIds;
  const index = ids.indexOf(branchId);
  if (index === -1) ids.push(branchId);
  else ids.splice(index, 1);
}

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (f.firstName.trim().length < 2) missing.push('nombre');
  if (!f.paternalLastName.trim()) missing.push('apellido paterno');
  if (!f.specialty.trim()) missing.push('especialidad');
  if (!f.shift) missing.push('turno');
  if (f.branchIds.length === 0) missing.push('sede');
  return missing;
});

const confirmDescription = computed(() => {
  const f = form.value;
  const fullName = [
    f.firstName,
    f.middleName,
    f.paternalLastName,
    f.maternalLastName,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
  const branchNames = f.branchIds
    .map((id) => branches.value.find((b) => b.id === id)?.name ?? id)
    .join(', ');
  return `"${fullName}" quedará registrado como coach de ${f.specialty} en ${branchNames}, turno ${shiftLabel(f.shift)}. Iniciará fuera de turno hasta que se active.`;
});

function askSubmit(): void {
  if (missingFields.value.length > 0) {
    formError.value = `Campos obligatorios faltantes: ${missingFields.value.join(', ')}`;
    return;
  }
  formError.value = null;
  confirmModalOpen.value = true;
}

async function submit(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    const f = form.value;
    const trainer = await $api<Trainer>('/api/trainers', {
      method: 'POST',
      body: {
        firstName: f.firstName.trim(),
        middleName: f.middleName.trim(),
        paternalLastName: f.paternalLastName.trim(),
        maternalLastName: f.maternalLastName.trim(),
        specialty: f.specialty.trim(),
        shift: f.shift,
        branchIds: f.branchIds,
        avatar: f.avatar,
      },
    });
    confirmModalOpen.value = false;
    await navigateTo(`/entrenadores/${trainer.id}`);
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo crear el coach';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  /// La recepción no gestiona personal — fuera.
  if (!canCreateTrainer.value) {
    await navigateTo('/entrenadores');
    return;
  }
  try {
    branches.value = await $api<Branch[]>('/api/branches');
    if (form.value.branchIds.length === 0 && branches.value.length) {
      form.value.branchIds = [branches.value[0]!.id];
    }
  } catch {
    branches.value = [];
  }
});
</script>

<template>
  <div class="space-y-6">
    <button
      type="button"
      class="inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted transition hover:text-accent"
      @click="router.back()"
    >
      <ArrowLeft class="h-4 w-4 text-accent" />
      Volver
    </button>

    <div>
      <h1 class="text-xl font-black text-text-primary">Nuevo coach</h1>
      <p class="mt-1 text-[11px] text-text-dim">
        Registro de entrenador — queda asignado a la sede y aparece disponible
        para programar clases.
      </p>
    </div>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Datos personales
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Nombre *</span
          >
          <input
            v-model="form.firstName"
            type="text"
            placeholder="ej. Diego"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Segundo nombre</span
          >
          <input
            v-model="form.middleName"
            type="text"
            placeholder="ej. Andrés"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Apellido paterno *</span
          >
          <input
            v-model="form.paternalLastName"
            type="text"
            placeholder="ej. Salvatierra"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Apellido materno</span
          >
          <input
            v-model="form.maternalLastName"
            type="text"
            placeholder="ej. Paz"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="col-span-2 block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Especialidad *</span
          >
          <input
            v-model="form.specialty"
            type="text"
            placeholder="ej. Crossfit, Yoga, Spinning…"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Avatar
      </h2>
      <p class="mt-1 text-[11px] text-text-dim">
        Identidad ilustrada del coach — es lo que ven los socios en la app.
      </p>
      <div class="mt-4 grid grid-cols-6 gap-3">
        <button
          v-for="id in COACH_AVATAR_IDS"
          :key="id"
          type="button"
          class="cursor-pointer overflow-hidden rounded-full border-2 transition"
          :class="
            form.avatar === id
              ? 'border-accent'
              : 'border-stroke hover:border-text-dim'
          "
          @click="form.avatar = id"
        >
          <img
            :src="`/avatars/coaches/${id}.svg`"
            :alt="`Avatar ${id}`"
            class="aspect-square w-full"
          />
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Asignación
      </h2>
      <div class="mt-4 space-y-4">
        <div class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Sedes *</span
          >
          <!-- Admin puede asignar varias; el gerente queda fijo en la suya. -->
          <div v-if="isAdmin" class="mt-1 flex flex-wrap gap-2">
            <button
              v-for="branch in branches"
              :key="branch.id"
              type="button"
              class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
              :class="
                form.branchIds.includes(branch.id)
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-stroke bg-base text-text-dim hover:text-text-muted'
              "
              @click="toggleBranch(branch.id)"
            >
              {{ branch.name }}
            </button>
          </div>
          <div
            v-else
            class="mt-1 flex items-center gap-2 rounded-xl border border-stroke bg-base px-3 py-2 text-sm font-bold text-text-primary"
          >
            <Lock class="h-3.5 w-3.5 text-accent" />
            {{ lockedBranchName }}
          </div>
        </div>
        <div class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Turno *</span
          >
          <div class="mt-1 flex flex-wrap gap-2">
            <button
              v-for="s in shiftOptions"
              :key="s"
              type="button"
              class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
              :class="
                form.shift === s
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-stroke bg-base text-text-dim hover:text-text-muted'
              "
              @click="form.shift = s"
            >
              {{ shiftLabel(s) }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <p v-if="formError" class="text-[11px] font-bold text-red-400">
      {{ formError }}
    </p>

    <button
      class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
      :disabled="saving"
      @click="askSubmit"
    >
      <UserPlus class="h-4 w-4" />
      {{ saving ? 'Registrando…' : 'Registrar coach' }}
    </button>

    <UModal
      v-model:open="confirmModalOpen"
      title="Registrar nuevo coach"
      :description="confirmDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="confirmModalOpen = false"
          />
          <UButton
            label="Registrar coach"
            icon="i-lucide-user-plus"
            :loading="saving"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
