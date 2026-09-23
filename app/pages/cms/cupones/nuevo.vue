<script setup lang="ts">
import {
  ArrowLeft,
  BatteryFull,
  Dumbbell,
  Signal,
  TicketPercent,
  Wifi,
} from '@lucide/vue';

import type { Branch, MembershipPlan } from '#shared/types';

const router = useRouter();
const { session } = useAuth();
/// Cupones = contenido comercial global — solo el admin los crea.
const isAdmin = computed(() => session.value?.role === 'ADMIN');
const { createCoupon } = useCms();

const branches = ref<Branch[]>([]);
const plans = ref<MembershipPlan[]>([]);
const saving = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);

const form = ref({
  title: '',
  description: '',
  badge: '-25%',
  code: '',
  planIds: ['ALL'] as string[],
  branchId: 'todas',
});

const branchItems = computed(() => [
  { label: 'Todas las sedes', value: 'todas' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

function planLabel(planId: string): string {
  if (planId === 'ALL') return 'Todos los socios';
  return plans.value.find((p) => p.id === planId)?.name ?? planId;
}

function togglePlan(planId: string): void {
  if (planId === 'ALL') {
    form.value.planIds = ['ALL'];
    return;
  }
  const list = form.value.planIds.filter((p) => p !== 'ALL');
  const index = list.indexOf(planId);
  if (index === -1) list.push(planId);
  else list.splice(index, 1);
  form.value.planIds = list;
}

function branchName(id: string | null): string {
  if (!id || id === 'todas') return 'todas las sedes';
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (!f.title.trim()) missing.push('título');
  if (!f.code.trim()) missing.push('código');
  if (f.planIds.length === 0) missing.push('planes con acceso');
  return missing;
});

const confirmDescription = computed(() => {
  const f = form.value;
  const audience = f.planIds.includes('ALL')
    ? 'todos los socios'
    : `socios con ${f.planIds.map(planLabel).join(', ')}`;
  return `Se creará el cupón "${f.title.trim()}" (${f.code.trim().toUpperCase()}) para ${audience} · ${branchName(f.branchId)}. Aparecerá en Promociones de la app.`;
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
    await createCoupon({
      title: f.title.trim(),
      description: f.description.trim(),
      badge: f.badge.trim() || 'NUEVO',
      code: f.code.trim().toUpperCase(),
      planIds: f.planIds,
      branchId: f.branchId === 'todas' ? null : f.branchId,
    });
    confirmModalOpen.value = false;
    await navigateTo('/cms');
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo crear el cupón';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  if (!isAdmin.value) {
    await navigateTo('/cms');
    return;
  }
  try {
    const [branchList, planList] = await Promise.all([
      $api<Branch[]>('/api/branches'),
      $api<MembershipPlan[]>('/api/plans'),
    ]);
    branches.value = branchList;
    plans.value = planList;
  } catch {
    branches.value = [];
    plans.value = [];
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
      <h1 class="text-xl font-black text-text-primary">Nuevo cupón</h1>
      <p class="mt-1 text-[11px] text-text-dim">
        Se publica en Promociones de la app según el plan de membresía del
        socio.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div class="space-y-6">
        <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Datos del cupón
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="col-span-2 block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Título *</span
          >
          <input
            v-model="form.title"
            type="text"
            placeholder="ej. Semana de recuperación"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="col-span-2 block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Descripción del beneficio</span
          >
          <input
            v-model="form.description"
            type="text"
            placeholder="ej. Sesión de masaje gratis con tu plan"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Badge</span
          >
          <input
            v-model="form.badge"
            type="text"
            placeholder="ej. -25%"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Código *</span
          >
          <input
            v-model="form.code"
            type="text"
            placeholder="ej. CF-PRO25"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 font-mono text-sm uppercase text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Segmentación
      </h2>
      <div class="mt-4 space-y-4">
        <div class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Planes con acceso *</span
          >
          <div class="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
              :class="
                form.planIds.includes('ALL')
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-stroke bg-base text-text-dim hover:text-text-muted'
              "
              @click="togglePlan('ALL')"
            >
              Todos los socios
            </button>
            <button
              v-for="plan in plans"
              :key="plan.id"
              type="button"
              class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
              :class="
                form.planIds.includes(plan.id)
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-stroke bg-base text-text-dim hover:text-text-muted'
              "
              @click="togglePlan(plan.id)"
            >
              {{ plan.name }}
            </button>
          </div>
        </div>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Sede</span
          >
          <USelectMenu
            v-model="form.branchId"
            :items="branchItems"
            value-key="value"
            class="mt-1 w-full"
          />
        </label>
      </div>
        </section>
      </div>

      <div class="flex flex-col space-y-4">
        <section
          class="flex flex-1 flex-col rounded-2xl border border-stroke bg-surface p-5"
        >
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Así se verá en la app
      </h2>

      <div class="mt-4 flex flex-1 items-center justify-center">
        <div
          class="w-full max-w-[260px] rounded-[2.4rem] border-4 border-stroke bg-black p-1.5 shadow-2xl"
        >
          <div
            class="relative flex h-[420px] flex-col overflow-hidden rounded-[1.9rem] bg-base"
          >
            <!-- Dynamic island -->
            <div
              class="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black"
            />

            <!-- Status bar -->
            <div
              class="flex items-center justify-between px-6 pt-3 text-[9px] font-bold text-text-primary"
            >
              <span>9:41</span>
              <span class="flex items-center gap-1 text-text-primary">
                <Signal class="h-2.5 w-2.5" />
                <Wifi class="h-2.5 w-2.5" />
                <BatteryFull class="h-3 w-3" />
              </span>
            </div>

            <!-- App: sección Promociones -->
            <div class="flex flex-1 flex-col px-3 pt-8">
              <div class="flex items-center gap-1.5 px-1">
                <div
                  class="flex h-5 w-5 items-center justify-center rounded-md bg-accent"
                >
                  <Dumbbell class="h-3 w-3 text-base" />
                </div>
                <p
                  class="text-[9px] font-black uppercase tracking-widest text-text-primary"
                >
                  RIR-HUB
                </p>
              </div>
              <p
                class="mt-3 px-1 text-[8px] font-bold uppercase tracking-widest text-text-dim"
              >
                Promociones
              </p>

              <!-- Coupon card -->
              <div
                class="mt-1.5 rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <p
                    class="truncate text-[11px] font-black text-text-primary"
                  >
                    {{ form.title || 'Título del cupón' }}
                  </p>
                  <span
                    class="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[8px] font-black text-accent"
                  >
                    {{ form.badge || 'NUEVO' }}
                  </span>
                </div>
                <p class="mt-0.5 text-[9px] text-text-dim">
                  {{ form.description || 'Descripción del beneficio' }}
                </p>
                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    class="rounded-lg border border-stroke bg-surface px-2 py-0.5 font-mono text-[9px] font-black text-accent"
                  >
                    {{ form.code || 'CÓDIGO' }}
                  </span>
                  <span
                    v-for="planId in form.planIds"
                    :key="planId"
                    class="rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-bold text-text-muted"
                  >
                    {{ planLabel(planId) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Home indicator -->
            <div
              class="mx-auto mb-2 h-1 w-24 rounded-full bg-text-dim/60"
            />
          </div>
        </div>
      </div>

          <p v-if="formError" class="mt-3 text-[11px] font-bold text-red-400">
            {{ formError }}
          </p>

          <button
            class="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
            :disabled="saving"
            @click="askSubmit"
          >
            <TicketPercent class="h-4 w-4" />
            {{ saving ? 'Creando…' : 'Crear cupón' }}
          </button>
        </section>
      </div>
    </div>

    <UModal
      v-model:open="confirmModalOpen"
      title="Crear cupón"
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
            label="Crear cupón"
            icon="i-lucide-ticket-percent"
            :loading="saving"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
