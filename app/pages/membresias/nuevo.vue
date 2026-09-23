<script setup lang="ts">
import { ArrowLeft, Check, Plus, X } from '@lucide/vue';

import type { MembershipPlan } from '#shared/types';

const router = useRouter();
const { session } = useAuth();
/// Los planes y sus precios son datos globales — solo el admin los crea.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const saving = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);

const form = ref({
  name: '',
  price: 0,
  allBranches: false,
  highlight: false,
  features: [] as string[],
});

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (f.name.trim().length < 3) missing.push('nombre');
  if (f.price <= 0) missing.push('precio');
  return missing;
});

const confirmDescription = computed(() => {
  const f = form.value;
  const features = f.features.filter((x) => x.trim());
  return `'${f.name.trim()}' quedará en el catálogo a $ ${f.price}/mes, con ${f.allBranches ? 'acceso a todas las sedes' : 'acceso solo a la sede de registro'}${f.highlight ? ' y destaque PREMIUM' : ''}. Beneficios: ${features.length}.`;
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
    const plan = await $api<MembershipPlan>('/api/plans', {
      method: 'POST',
      body: {
        name: f.name.trim(),
        price: f.price,
        allBranches: f.allBranches,
        highlight: f.highlight,
        features: f.features.filter((x) => x.trim()),
      },
    });
    confirmModalOpen.value = false;
    await navigateTo(`/membresias/${plan.id}`);
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo crear el plan';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  /// Solo el admin global crea membresías — fuera.
  if (!isAdmin.value) {
    await navigateTo('/membresias');
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
      <h1 class="text-xl font-black text-text-primary">Nueva membresía</h1>
      <p class="mt-1 text-[11px] text-text-dim">
        Plan global del catálogo — queda disponible para asignar a socios en
        cualquier sede.
      </p>
    </div>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Información del plan
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Nombre *</span
          >
          <input
            v-model="form.name"
            type="text"
            placeholder="ej. Plan Fit"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Precio (MXN/mes) *</span
          >
          <input
            v-model.number="form.price"
            type="number"
            min="0"
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
        Beneficios
      </h2>
      <div class="mt-3 space-y-2">
        <div
          v-for="(_, index) in form.features"
          :key="index"
          class="flex items-center gap-2"
        >
          <input
            v-model="form.features[index]"
            type="text"
            placeholder="ej. Acceso a todas las sedes"
            class="flex-1 rounded-xl border border-stroke bg-base px-3 py-2 text-xs text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <button
            class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-red-400 hover:text-red-400"
            title="Quitar beneficio"
            @click="form.features.splice(index, 1)"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
        <button
          class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-stroke px-3 text-[11px] font-black text-text-muted transition hover:border-accent hover:text-accent"
          @click="form.features.push('')"
        >
          <Plus class="h-3.5 w-3.5" />
          Agregar beneficio
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Alcance
      </h2>
      <div class="mt-4 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-text-muted">
            Acceso a todas las sedes
          </span>
          <button
            type="button"
            class="relative h-6 w-11 cursor-pointer rounded-full transition"
            :class="
              form.allBranches ? 'bg-accent' : 'bg-base border border-stroke'
            "
            @click="form.allBranches = !form.allBranches"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="
                form.allBranches ? 'left-[22px] bg-base' : 'left-0.5 bg-white'
              "
            />
          </button>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-text-muted">
            Destacar como PREMIUM
          </span>
          <button
            type="button"
            class="relative h-6 w-11 cursor-pointer rounded-full transition"
            :class="form.highlight ? 'bg-accent' : 'bg-base border border-stroke'"
            @click="form.highlight = !form.highlight"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="form.highlight ? 'left-[22px] bg-base' : 'left-0.5 bg-white'"
            />
          </button>
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
      <Check class="h-4 w-4" />
      {{ saving ? 'Creando…' : 'Crear membresía' }}
    </button>

    <UModal
      v-model:open="confirmModalOpen"
      title="Crear nueva membresía"
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
            label="Crear membresía"
            icon="i-lucide-check"
            :loading="saving"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
