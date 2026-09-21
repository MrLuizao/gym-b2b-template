<script setup lang="ts">
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from '@lucide/vue';

import type { PlanDetail } from '#shared/types';

const route = useRoute();
const detail = ref<PlanDetail | null>(null);
const pending = ref(true);
const saving = ref(false);
const editing = ref(false);

const editForm = ref({
  name: '',
  level: 'CLASSIC',
  priceBs: 0,
  allBranches: false,
  highlight: false,
  features: [] as string[],
});

const levelItems = [
  { label: 'CLASSIC', value: 'CLASSIC' },
  { label: 'PLUS', value: 'PLUS' },
  { label: 'BLACK', value: 'BLACK' },
];

const saveModalOpen = ref(false);
const saveModalDescription = ref('');
const saveModalEmpty = ref(false);

const toggleModalOpen = ref(false);
const pendingToggle = ref<{
  field: 'allBranches' | 'highlight';
  title: string;
  description: string;
} | null>(null);

const deleteModalOpen = ref(false);
const deleting = ref(false);

onMounted(async () => {
  try {
    await load();
  } finally {
    pending.value = false;
  }
});

async function load(): Promise<void> {
  detail.value = await $fetch<PlanDetail>(`/api/plans/${route.params.id}`);
}

function levelBadgeCls(level: string): string {
  if (level === 'BLACK') return 'border-accent/40 bg-accent/10 text-accent';
  if (level === 'PLUS')
    return 'border-sky-400/30 bg-sky-400/10 text-sky-400';
  return 'border-stroke bg-base text-text-muted';
}

function startEdit(): void {
  const p = detail.value?.plan;
  if (!p) return;
  editForm.value = {
    name: p.name,
    level: p.level,
    priceBs: p.priceBs,
    allBranches: p.allBranches,
    highlight: p.highlight,
    features: [...p.features],
  };
  editing.value = true;
}

const planChanges = computed<string[]>(() => {
  const p = detail.value?.plan;
  if (!p) return [];
  const changes: string[] = [];
  if (editForm.value.name !== p.name)
    changes.push(
      `Nombre: '${p.name}' → '${editForm.value.name}' — socios y pagos con este plan se actualizarán`,
    );
  if (editForm.value.level !== p.level)
    changes.push(`Nivel: ${p.level} → ${editForm.value.level}`);
  if (editForm.value.priceBs !== p.priceBs)
    changes.push(`Precio: Bs ${p.priceBs} → Bs ${editForm.value.priceBs}`);
  if (editForm.value.allBranches !== p.allBranches)
    changes.push(
      editForm.value.allBranches
        ? 'Los socios con este plan podrán ingresar a cualquier sede'
        : 'Los socios con este plan quedarán limitados a su sede de registro',
    );
  if (editForm.value.highlight !== p.highlight)
    changes.push(
      editForm.value.highlight
        ? 'El plan se destacará como PREMIUM'
        : 'El plan dejará de destacarse',
    );
  const before = [...p.features].sort().join('|');
  const after = editForm.value.features
    .filter((f) => f.trim())
    .sort()
    .join('|');
  if (before !== after)
    changes.push(
      `Beneficios actualizados (${editForm.value.features.filter((f) => f.trim()).length} items)`,
    );
  return changes;
});

function confirmSave(): void {
  saveModalDescription.value = planChanges.value.length
    ? `${planChanges.value.join('. ')}.`
    : 'No se detectaron cambios respecto a los datos actuales.';
  saveModalEmpty.value = planChanges.value.length === 0;
  saveModalOpen.value = true;
}

async function savePlan(): Promise<void> {
  if (!detail.value || saving.value) return;
  saving.value = true;
  try {
    await $fetch<PlanDetail['plan']>(
      `/api/plans/${detail.value.plan.id}`,
      {
        method: 'PUT',
        body: {
          ...editForm.value,
          features: editForm.value.features.filter((f) => f.trim()),
        },
      },
    );
    await load();
    editing.value = false;
  } finally {
    saving.value = false;
  }
}

async function runSave(): Promise<void> {
  await savePlan();
  saveModalOpen.value = false;
}

function confirmToggle(field: 'allBranches' | 'highlight'): void {
  const planName = detail.value?.plan.name ?? 'este plan';
  const turningOn = !editForm.value[field];
  pendingToggle.value =
    field === 'allBranches'
      ? {
          field,
          title: turningOn
            ? 'Activar acceso a todas las sedes'
            : 'Restringir a sede de registro',
          description: turningOn
            ? `Los socios con '${planName}' podrán ingresar a cualquier sede al guardar.`
            : `Los socios con '${planName}' quedarán limitados a su sede de registro al guardar.`,
        }
      : {
          field,
          title: turningOn
            ? 'Destacar plan como PREMIUM'
            : 'Quitar destaque PREMIUM',
          description: turningOn
            ? `'${planName}' se mostrará destacado en la app y en el catálogo al guardar.`
            : `'${planName}' dejará de mostrarse destacado al guardar.`,
        };
  toggleModalOpen.value = true;
}

function applyToggle(): void {
  if (!pendingToggle.value) return;
  const field = pendingToggle.value.field;
  editForm.value[field] = !editForm.value[field];
  pendingToggle.value = null;
  toggleModalOpen.value = false;
}

function confirmDelete(): void {
  deleteModalOpen.value = true;
}

async function deletePlan(): Promise<void> {
  if (!detail.value || deleting.value) return;
  deleting.value = true;
  try {
    await $fetch(`/api/plans/${detail.value.plan.id}`, { method: 'DELETE' });
    deleteModalOpen.value = false;
    await navigateTo('/membresias');
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
    Cargando plan…
  </div>

  <div v-else-if="detail" class="space-y-6">
    <div class="flex items-center gap-4">
      <div
        class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-xl font-black"
        :class="
          detail.plan.highlight
            ? 'border-accent/60 bg-accent/10 text-accent'
            : 'border-stroke bg-surface text-text-muted'
        "
      >
        {{ detail.plan.level.charAt(0) }}
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-black text-text-primary">
          {{ detail.plan.name }}
        </h1>
        <p class="mt-1 text-[11px] text-text-dim">
          Bs {{ detail.plan.priceBs }} /mes ·
          {{
            detail.plan.allBranches
              ? 'Acceso a todas las sedes'
              : 'Solo sede de registro'
          }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span
          class="rounded-full border px-3 py-1 text-[11px] font-black"
          :class="levelBadgeCls(detail.plan.level)"
        >
          {{ detail.plan.level }}
        </span>
        <span
          v-if="detail.plan.highlight"
          class="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-black text-accent"
        >
          PREMIUM
        </span>
      </div>
    </div>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="flex items-center justify-between">
        <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Información del plan
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

      <div v-if="!editing" class="mt-4 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Precio mensual
            </p>
            <p class="mt-1 text-sm font-black text-text-primary">
              Bs {{ detail.plan.priceBs }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Acceso a sedes
            </p>
            <p class="mt-1 text-sm font-black text-text-primary">
              {{
                detail.plan.allBranches
                  ? 'Todas las sedes'
                  : 'Solo sede de registro'
              }}
            </p>
          </div>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Beneficios
          </p>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="feature in detail.plan.features"
              :key="feature"
              class="flex items-center gap-2 text-[11px] font-medium text-text-muted"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-accent" />
              {{ feature }}
            </li>
          </ul>
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
              Nivel
            </span>
            <USelectMenu
              v-model="editForm.level"
              :items="levelItems"
              value-key="value"
              class="mt-1 w-full"
            />
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Precio (Bs/mes)
            </span>
            <input
              v-model.number="editForm.priceBs"
              type="number"
              min="0"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Beneficios
          </p>
          <div class="mt-2 space-y-2">
            <div
              v-for="(_, index) in editForm.features"
              :key="index"
              class="flex items-center gap-2"
            >
              <input
                v-model="editForm.features[index]"
                type="text"
                class="flex-1 rounded-xl border border-stroke bg-base px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
              <button
                class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-red-400 hover:text-red-400"
                title="Quitar beneficio"
                @click="editForm.features.splice(index, 1)"
              >
                <X class="h-3 w-3" />
              </button>
            </div>
            <button
              class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-stroke px-3 text-[11px] font-black text-text-muted transition hover:border-accent hover:text-accent"
              @click="editForm.features.push('')"
            >
              <Plus class="h-3.5 w-3.5" />
              Agregar beneficio
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-text-muted">
            Acceso a todas las sedes
          </span>
          <button
            class="relative h-6 w-11 cursor-pointer rounded-full transition"
            :class="
              editForm.allBranches ? 'bg-accent' : 'bg-base border border-stroke'
            "
            @click="confirmToggle('allBranches')"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="
                editForm.allBranches
                  ? 'left-[22px] bg-base'
                  : 'left-0.5 bg-white'
              "
            />
          </button>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-text-muted">
            Destacar como PREMIUM
          </span>
          <button
            class="relative h-6 w-11 cursor-pointer rounded-full transition"
            :class="
              editForm.highlight ? 'bg-accent' : 'bg-base border border-stroke'
            "
            @click="confirmToggle('highlight')"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="
                editForm.highlight
                  ? 'left-[22px] bg-base'
                  : 'left-0.5 bg-white'
              "
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

    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Socios
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ detail.stats.members }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Pagos
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ detail.stats.payments }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Ingresos
        </p>
        <p class="mt-1 text-xl font-black text-text-primary">
          Bs {{ detail.stats.revenueBs }}
        </p>
      </div>
    </div>

    <button
      class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-400/40 bg-red-400/10 text-xs font-black text-red-400 transition hover:bg-red-400/20"
      @click="confirmDelete"
    >
      <Trash2 class="h-4 w-4" />
      Eliminar plan
    </button>

    <UModal
      v-model:open="saveModalOpen"
      title="Guardar cambios del plan"
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
      v-model:open="toggleModalOpen"
      :title="pendingToggle?.title ?? ''"
      :description="pendingToggle?.description ?? ''"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="toggleModalOpen = false"
          />
          <UButton label="Confirmar" @click="applyToggle" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteModalOpen"
      title="Eliminar plan"
      :description="
        detail?.stats.members
          ? `'${detail.plan.name}' tiene ${detail.stats.members} socio(s) asignados — reasígnalos a otro plan antes de eliminarlo.`
          : `Se eliminará '${detail?.plan.name}' del catálogo. Esta acción no se puede deshacer.`
      "
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
            label="Eliminar plan"
            color="error"
            :disabled="(detail?.stats.members ?? 0) > 0"
            :loading="deleting"
            @click="deletePlan"
          />
        </div>
      </template>
    </UModal>

    <NuxtLink
      to="/membresias"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Membresías
    </NuxtLink>
  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Plan no encontrado
  </div>
</template>
