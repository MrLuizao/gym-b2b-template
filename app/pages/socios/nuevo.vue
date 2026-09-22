<script setup lang="ts">
import {
  ArrowLeft,
  Check,
  Globe,
  Lock,
  Sparkles,
  UserPlus,
} from '@lucide/vue';

import {
  CalendarDate,
  DateFormatter,
  getLocalTimeZone,
  today,
  type DateValue,
} from '@internationalized/date';

import type { Branch, Member, MembershipPlan } from '#shared/types';

const { session } = useAuth();
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const branches = ref<Branch[]>([]);
const plans = ref<MembershipPlan[]>([]);
const saving = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);

const form = ref({
  firstName: '',
  middleName: '',
  paternalLastName: '',
  maternalLastName: '',
  sex: '',
  birthDate: '',
  phone: '',
  idNumber: '',
  branchId: session.value?.branchId ?? '',
  planId: '',
  method: 'Efectivo',
  amountBs: 0,
  folio: '',
});

const sexOptions = [
  { label: 'Masculino', value: 'M' },
  { label: 'Femenino', value: 'F' },
  { label: 'Otro', value: 'O' },
];

const methodOptions = ['Efectivo', 'Tarjeta', 'Transferencia'];

/// UCalendar trabaja con CalendarDate — el form guarda ISO 'YYYY-MM-DD'.
const maxBirthDate = today(getLocalTimeZone());
const dateFormatter = new DateFormatter('es-BO', { dateStyle: 'medium' });
const birthDateValue = computed<DateValue | null>({
  get: () => {
    const [y, m, d] = (form.value.birthDate || '').split('-').map(Number);
    return y && m && d ? new CalendarDate(y, m, d) : null;
  },
  set: (value) => {
    form.value.birthDate = value ? value.toString() : '';
  },
});

/// El gerente/recepcionista solo inscribe en su propia sede; por defecto se
/// preselecciona la sede del usuario logueado.
const branchItems = computed(() =>
  branches.value
    .filter((b) => isAdmin.value || b.id === session.value?.branchId)
    .map((b) => ({ label: b.name, value: b.id })),
);

const selectedPlan = computed(
  () => plans.value.find((p) => p.id === form.value.planId) ?? null,
);

/// Tarjeta/transferencia los procesa un tercero: el folio del comprobante
/// es obligatorio; en efectivo se genera un folio interno automático.
const folioRequired = computed(() => form.value.method !== 'Efectivo');

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (f.firstName.trim().length < 2) missing.push('nombre');
  if (!f.paternalLastName.trim()) missing.push('apellido paterno');
  if (!f.sex) missing.push('sexo');
  if (!f.birthDate) missing.push('fecha de nacimiento');
  if (!f.idNumber.trim()) missing.push('identificación');
  if (!f.phone.trim()) missing.push('teléfono');
  if (!f.branchId) missing.push('sede');
  if (!f.planId) missing.push('plan');
  if (f.amountBs <= 0) missing.push('monto');
  if (folioRequired.value && !f.folio.trim()) missing.push('folio de pago');
  return missing;
});

const confirmDescription = computed(() => {
  const f = form.value;
  const plan = selectedPlan.value;
  const branch = branches.value.find((b) => b.id === f.branchId);
  const fullName = [
    f.firstName,
    f.middleName,
    f.paternalLastName,
    f.maternalLastName,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
  return `"${fullName}" quedará inscrito en ${branch?.name ?? 'la sede'} con plan ${plan?.name ?? ''} y primer pago de Bs ${f.amountBs} (${f.method}). Su membresía quedará activa por 30 días.`;
});

const lockedBranchName = computed(
  () =>
    branches.value.find((b) => b.id === form.value.branchId)?.name ??
    session.value?.branchName ??
    '',
);

function levelBadge(level: MembershipPlan['level']): string {
  switch (level) {
    case 'BLACK':
      return 'border-accent/40 bg-accent/10 text-accent';
    case 'PLUS':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-400';
    default:
      return 'border-stroke bg-white/5 text-text-muted';
  }
}

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
    const result = await $fetch<{ member: Member }>('/api/members', {
      method: 'POST',
      body: {
        firstName: f.firstName.trim(),
        middleName: f.middleName.trim(),
        paternalLastName: f.paternalLastName.trim(),
        maternalLastName: f.maternalLastName.trim(),
        sex: f.sex || null,
        birthDate: f.birthDate || null,
        phone: f.phone.trim(),
        idNumber: f.idNumber.trim(),
        branchId: f.branchId,
        planId: f.planId,
        method: f.method,
        amountBs: f.amountBs,
        folio: f.folio.trim(),
      },
    });
    confirmModalOpen.value = false;
    await navigateTo(`/socios/${result.member.id}`);
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo crear el socio';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    const [branchList, planList] = await Promise.all([
      $fetch<Branch[]>('/api/branches'),
      $fetch<MembershipPlan[]>('/api/plans'),
    ]);
    branches.value = branchList;
    plans.value = planList;
    if (!form.value.branchId) {
      form.value.branchId = branchItems.value[0]?.value ?? '';
    }
    if (planList.length && !form.value.planId) {
      form.value.planId = planList[0]!.id;
      form.value.amountBs = planList[0]!.priceBs;
    }
  } catch {
    branches.value = [];
    plans.value = [];
  }
});

watch(
  () => form.value.planId,
  (id) => {
    const plan = plans.value.find((p) => p.id === id);
    if (plan) form.value.amountBs = plan.priceBs;
  },
);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-black text-text-primary">Nuevo socio</h1>
      <p class="mt-1 text-[11px] text-text-dim">
        Inscripción de mostrador — queda con membresía activa por 30 días y su
        primer pago registrado.
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
            placeholder="ej. María"
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
            placeholder="ej. Fernanda"
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
            placeholder="ej. Ríos"
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
            placeholder="ej. Vargas"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <div class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Sexo *</span
          >
          <div class="mt-1 flex gap-2">
            <UCheckbox
              v-for="opt in sexOptions"
              :key="opt.value"
              color="primary"
              size="xl"
              variant="list"
              :model-value="form.sex === opt.value"
              :label="opt.label"
              class="flex-1"
              @update:model-value="form.sex = $event ? opt.value : ''"
            />
          </div>
        </div>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Fecha de nacimiento *</span
          >
          <UPopover class="mt-1">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-calendar"
              class="w-full justify-start"
            >
              {{
                birthDateValue
                  ? dateFormatter.format(
                      birthDateValue.toDate(getLocalTimeZone()),
                    )
                  : 'Selecciona fecha'
              }}
            </UButton>
            <template #content>
              <UCalendar
                v-model="birthDateValue"
                :max-value="maxBirthDate"
                class="p-2"
              />
            </template>
          </UPopover>
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >CI / Identificación *</span
          >
          <input
            v-model="form.idNumber"
            type="text"
            placeholder="ej. 6123456 SC"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Teléfono *</span
          >
          <input
            v-model="form.phone"
            type="tel"
            placeholder="ej. 70012345"
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
        Plan de membresía
      </h2>
      <div class="mt-4 block">
        <span
          class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >Sede de registro *</span
        >
        <!-- Admin elige cualquier sede; el staff queda fijo en la suya. -->
        <USelectMenu
          v-if="isAdmin"
          v-model="form.branchId"
          :items="branchItems"
          value-key="value"
          class="mt-1 w-full"
        />
        <div
          v-else
          class="mt-1 flex items-center gap-2 rounded-xl border border-stroke bg-base px-3 py-2 text-sm font-bold text-text-primary"
        >
          <Lock class="h-3.5 w-3.5 text-accent" />
          {{ lockedBranchName }}
        </div>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          v-for="plan in plans"
          :key="plan.id"
          type="button"
          class="relative cursor-pointer rounded-2xl border p-4 text-left transition"
          :class="
            form.planId === plan.id
              ? 'border-accent bg-accent/10'
              : 'border-stroke bg-base hover:border-text-dim'
          "
          @click="form.planId = plan.id"
        >
          <span
            v-if="plan.highlight"
            class="absolute -top-2 right-3 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-black text-base"
          >
            <Sparkles class="h-2.5 w-2.5" />
            POPULAR
          </span>
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-black text-text-primary">{{ plan.name }}</p>
            <span
              class="rounded-full border px-2 py-0.5 text-[9px] font-black"
              :class="levelBadge(plan.level)"
            >
              {{ plan.level }}
            </span>
          </div>
          <p class="mt-2 text-xl font-black text-accent">
            Bs {{ plan.priceBs }}
            <span class="text-[10px] font-semibold text-text-dim">/mes</span>
          </p>
          <p
            v-if="plan.allBranches"
            class="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-text-muted"
          >
            <Globe class="h-3 w-3 text-accent" />
            Acceso a todas las sedes
          </p>
          <ul class="mt-2 space-y-1">
            <li
              v-for="feature in plan.features.slice(0, 3)"
              :key="feature"
              class="flex items-start gap-1.5 text-[10px] font-medium leading-snug text-text-dim"
            >
              <Check class="mt-0.5 h-3 w-3 shrink-0 text-accent" />
              {{ feature }}
            </li>
          </ul>
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Primer pago
      </h2>
      <div class="mt-4 space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="m in methodOptions"
            :key="m"
            type="button"
            class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
            :class="
              form.method === m
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-stroke bg-base text-text-dim hover:text-text-muted'
            "
            @click="form.method = m"
          >
            {{ m }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Monto (Bs) *</span
            >
            <input
              v-model.number="form.amountBs"
              type="number"
              min="1"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm font-black text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Folio del comprobante{{ folioRequired ? ' *' : '' }}</span
            >
            <input
              v-model="form.folio"
              type="text"
              :placeholder="
                folioRequired
                  ? 'Folio del procesador de pago'
                  : 'Se genera automático'
              "
              class="mt-1 w-full rounded-xl border bg-base px-3 py-2 font-mono text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              :class="folioRequired ? 'border-accent/60' : 'border-stroke'"
            />
          </label>
        </div>
        <p class="text-[10px] leading-relaxed text-text-dim">
          {{
            folioRequired
              ? 'Pago por tercero (tarjeta o transferencia): ingresa el folio que entregó el procesador.'
              : 'En efectivo el folio se genera automáticamente si lo dejas vacío.'
          }}
        </p>
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
      {{ saving ? 'Registrando…' : 'Registrar socio' }}
    </button>

    <NuxtLink
      to="/socios"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Socios
    </NuxtLink>

    <UModal
      v-model:open="confirmModalOpen"
      title="Registrar nuevo socio"
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
            label="Registrar socio"
            icon="i-lucide-user-plus"
            :loading="saving"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
