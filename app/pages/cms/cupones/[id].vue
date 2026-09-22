<script setup lang="ts">
import {
  ArrowLeft,
  BatteryFull,
  Dumbbell,
  Save,
  Signal,
  Trash2,
  Wifi,
} from '@lucide/vue';

import type { Branch, Coupon, MembershipLevel } from '#shared/types';

const route = useRoute();
const router = useRouter();
const { session } = useAuth();
/// Cupones = contenido comercial global — solo el admin los edita.
const isAdmin = computed(() => session.value?.role === 'ADMIN');
const { updateCoupon, deleteCoupon } = useCms();

const coupon = ref<Coupon | null>(null);
const branches = ref<Branch[]>([]);
const pending = ref(true);
const saving = ref(false);
const deleting = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);
const deleteModalOpen = ref(false);

const LEVEL_OPTIONS: MembershipLevel[] = ['CLASSIC', 'PLUS', 'BLACK'];

const form = ref({
  title: '',
  description: '',
  badge: '',
  code: '',
  levels: [] as MembershipLevel[],
  branchId: 'todas',
});

const branchItems = computed(() => [
  { label: 'Todas las sedes', value: 'todas' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

function toggleLevel(level: MembershipLevel): void {
  const levels = form.value.levels;
  const index = levels.indexOf(level);
  if (index === -1) levels.push(level);
  else levels.splice(index, 1);
}

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (!f.title.trim()) missing.push('título');
  if (!f.code.trim()) missing.push('código');
  if (f.levels.length === 0) missing.push('nivel de membresía');
  return missing;
});

const confirmDescription = computed(
  () =>
    `Se actualizará el cupón "${form.value.title.trim()}" (${form.value.code.trim().toUpperCase()}) — los socios verán los cambios en Promociones.`,
);

function askSubmit(): void {
  if (missingFields.value.length > 0) {
    formError.value = `Campos obligatorios faltantes: ${missingFields.value.join(', ')}`;
    return;
  }
  formError.value = null;
  confirmModalOpen.value = true;
}

async function submit(): Promise<void> {
  if (!coupon.value || saving.value) return;
  saving.value = true;
  try {
    const f = form.value;
    await updateCoupon(coupon.value, {
      title: f.title.trim(),
      description: f.description.trim(),
      badge: f.badge.trim() || 'NUEVO',
      code: f.code.trim().toUpperCase(),
      levels: f.levels,
      branchId: f.branchId === 'todas' ? null : f.branchId,
    });
    confirmModalOpen.value = false;
    await navigateTo('/cms');
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo guardar';
  } finally {
    saving.value = false;
  }
}

async function remove(): Promise<void> {
  if (!coupon.value || deleting.value) return;
  deleting.value = true;
  try {
    await deleteCoupon(coupon.value);
    deleteModalOpen.value = false;
    await navigateTo('/cms');
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  const id = route.params.id as string;
  try {
    const [c, b] = await Promise.all([
      $fetch<Coupon>(`/api/cms/coupons/${id}`),
      $fetch<Branch[]>('/api/branches'),
    ]);
    coupon.value = c;
    branches.value = b;
    form.value = {
      title: c.title,
      description: c.description,
      badge: c.badge,
      code: c.code,
      levels: c.levels.filter((l): l is MembershipLevel =>
        LEVEL_OPTIONS.includes(l as MembershipLevel),
      ),
      branchId: c.branchId ?? 'todas',
    };
  } catch {
    coupon.value = null;
  } finally {
    pending.value = false;
  }
});
</script>

<template>
  <div
    v-if="pending"
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cargando cupón…
  </div>

  <div v-else-if="coupon" class="space-y-6">
    <button
      type="button"
      class="inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted transition hover:text-accent"
      @click="router.back()"
    >
      <ArrowLeft class="h-4 w-4 text-accent" />
      Volver
    </button>

    <div class="flex items-start gap-4">
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-black text-text-primary">
          {{ coupon.title }}
        </h1>
        <p class="mt-1 text-[11px] text-text-dim">
          Edición del cupón
          <span class="font-mono text-accent">{{ coupon.code }}</span> — visible
          en Promociones de la app.
        </p>
      </div>
      <button
        v-if="isAdmin"
        type="button"
        class="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-4 text-[11px] font-black text-red-400 transition hover:bg-red-400/20"
        @click="deleteModalOpen = true"
      >
        <Trash2 class="h-3.5 w-3.5" />
        Eliminar
      </button>
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
                :disabled="!isAdmin"
                placeholder="ej. Semana de recuperación"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent disabled:opacity-60"
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
                :disabled="!isAdmin"
                placeholder="ej. Sesión de masaje gratis con tu plan"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent disabled:opacity-60"
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
                :disabled="!isAdmin"
                placeholder="ej. -25%"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent disabled:opacity-60"
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
                :disabled="!isAdmin"
                placeholder="ej. CF-PRO25"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 font-mono text-sm uppercase text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent disabled:opacity-60"
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
                >Niveles con acceso *</span
              >
              <div class="mt-1 flex flex-wrap gap-2">
                <button
                  v-for="level in LEVEL_OPTIONS"
                  :key="level"
                  type="button"
                  :disabled="!isAdmin"
                  class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition disabled:cursor-default disabled:opacity-60"
                  :class="
                    form.levels.includes(level)
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-stroke bg-base text-text-dim hover:text-text-muted'
                  "
                  @click="toggleLevel(level)"
                >
                  {{ level }}
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
                :disabled="!isAdmin"
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
                <div
                  class="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black"
                />
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
                  <div
                    class="mt-1.5 rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-3"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate text-[11px] font-black text-text-primary">
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
                        v-for="level in form.levels"
                        :key="level"
                        class="rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-bold text-text-muted"
                      >
                        {{ level }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="mx-auto mb-2 h-1 w-24 rounded-full bg-text-dim/60" />
              </div>
            </div>
          </div>

          <p v-if="formError" class="mt-3 text-[11px] font-bold text-red-400">
            {{ formError }}
          </p>

          <button
            v-if="isAdmin"
            class="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
            :disabled="saving"
            @click="askSubmit"
          >
            <Save class="h-4 w-4" />
            {{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </section>

      </div>
    </div>

    <UModal
      v-model:open="confirmModalOpen"
      title="Guardar cambios del cupón"
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
            label="Guardar"
            icon="i-lucide-save"
            :loading="saving"
            @click="submit"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteModalOpen"
      title="Eliminar cupón"
      :description="`Se eliminará '${coupon.title}' (${coupon.code}) de Promociones. Esta acción no se puede deshacer.`"
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
            label="Eliminar"
            color="error"
            :loading="deleting"
            @click="remove"
          />
        </div>
      </template>
    </UModal>
  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cupón no encontrado
  </div>
</template>
