<script setup lang="ts">
import {
  ArrowLeft,
  BatteryFull,
  Dumbbell,
  Lock,
  Save,
  Signal,
  Wifi,
} from '@lucide/vue';
import {
  CalendarDate,
  DateFormatter,
  getLocalTimeZone,
  today,
  type DateValue,
} from '@internationalized/date';

import type { Branch, PushLog } from '#shared/types';

const router = useRouter();
const { session } = useAuth();
/// Push masivas = contenido comercial global — solo el admin las envía.
const isAdmin = computed(() => session.value?.role === 'ADMIN');
const { createPush } = useCms();

const branches = ref<Branch[]>([]);
const saving = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);

const form = ref({
  title: '',
  body: '',
  kind: 'BRAND' as PushLog['kind'],
  audience: 'ALL' as 'ALL' | 'BRANCH' | 'EXPIRED',
  branchId: '',
  time: '',
});

/// Fecha programada (opcional) — UCalendar trabaja con CalendarDate.
const scheduledDate = shallowRef<DateValue | null>(null);
const minScheduleDate = today(getLocalTimeZone());
const scheduleFormatter = new DateFormatter('es-BO', { dateStyle: 'medium' });

/// Timestamp combinado fecha+hora; null = envío manual al lanzarla.
const scheduledAt = computed<number | null>(() => {
  const d = scheduledDate.value;
  if (!d) return null;
  const [h, m] = (form.value.time || '09:00').split(':').map(Number);
  const date = d.toDate(getLocalTimeZone());
  date.setHours(h || 0, m || 0, 0, 0);
  return date.getTime();
});

const scheduledLabel = computed(() => {
  const ts = scheduledAt.value;
  if (!ts) return null;
  return `${scheduleFormatter.format(new Date(ts))} · ${form.value.time || '09:00'}`;
});

const kindOptions: { label: string; value: PushLog['kind'] }[] = [
  { label: 'De la marca', value: 'BRAND' },
  { label: 'Publicidad de aliado', value: 'SPONSOR' },
];

const audienceOptions: { label: string; value: 'ALL' | 'BRANCH' | 'EXPIRED' }[] =
  [
    { label: 'Todos los socios', value: 'ALL' },
    { label: 'Por sucursal', value: 'BRANCH' },
    { label: 'Membresías vencidas', value: 'EXPIRED' },
  ];

const branchItems = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.id })),
);

function branchName(id: string): string {
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

const audienceLabel = computed(() => {
  const f = form.value;
  if (f.audience === 'ALL') return 'todos los socios';
  if (f.audience === 'EXPIRED') return 'socios con membresía vencida';
  return `los socios de ${branchName(f.branchId)}`;
});

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (!f.title.trim()) missing.push('título');
  if (!f.body.trim()) missing.push('mensaje');
  if (f.audience === 'BRANCH' && !f.branchId) missing.push('sede');
  return missing;
});

const confirmDescription = computed(() => {
  const f = form.value;
  const optInNote =
    f.kind === 'SPONSOR'
      ? ' Solo llega a quienes activaron "Promos de aliados" en la app.'
      : '';
  const scheduleNote = scheduledLabel.value
    ? ` Quedará programada para el ${scheduledLabel.value}.`
    : ' Podrás lanzar el envío manualmente desde CMS.';
  return `Se guardará "${f.title.trim()}" dirigida a ${audienceLabel.value} como borrador.${scheduleNote}${optInNote}`;
});

function askSubmit(): void {
  if (missingFields.value.length > 0) {
    formError.value = `Campos obligatorios faltantes: ${missingFields.value.join(', ')}`;
    return;
  }
  if (scheduledAt.value !== null && scheduledAt.value <= Date.now()) {
    formError.value =
      'La fecha y hora programadas ya pasaron — elige una futura o déjalas vacías';
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
    await createPush({
      title: f.title.trim(),
      body: f.body.trim(),
      audience: f.audience,
      branchId: f.audience === 'BRANCH' ? f.branchId : null,
      kind: f.kind,
      scheduledAt: scheduledAt.value,
    });
    confirmModalOpen.value = false;
    await navigateTo('/cms');
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo enviar';
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
    branches.value = await $fetch<Branch[]>('/api/branches');
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
      <h1 class="text-xl font-black text-text-primary">Nueva notificación</h1>
      <p class="mt-1 text-[11px] text-text-dim">
        Envío masivo o segmentado vía Firebase Cloud Messaging.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div class="space-y-6">
        <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Contenido
      </h2>
      <div class="mt-4 space-y-3">
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Título *</span
          >
          <input
            v-model="form.title"
            type="text"
            placeholder="ej. Reto de octubre"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Mensaje *</span
          >
          <textarea
            v-model="form.body"
            rows="3"
            placeholder="Mensaje para los socios…"
            class="mt-1 w-full resize-none rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
        </label>
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Audiencia
      </h2>
      <div class="mt-4 space-y-4">
        <div class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Tipo de notificación</span
          >
          <div class="mt-1 flex flex-wrap gap-2">
            <button
              v-for="opt in kindOptions"
              :key="opt.value"
              type="button"
              class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
              :class="
                form.kind === opt.value
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-stroke bg-base text-text-dim hover:text-text-muted'
              "
              @click="form.kind = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Destinatarios</span
          >
          <USelectMenu
            v-model="form.audience"
            :items="audienceOptions"
            value-key="value"
            class="mt-1 w-full"
          />
        </label>
        <label v-if="form.audience === 'BRANCH'" class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Sede *</span
          >
          <USelectMenu
            v-model="form.branchId"
            :items="branchItems"
            value-key="value"
            placeholder="Selecciona sede…"
            class="mt-1 w-full"
          />
        </label>
        <p
          v-if="form.kind === 'SPONSOR'"
          class="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-[10px] font-bold text-text-muted"
        >
          Las notificaciones de aliados solo llegan a socios que activaron
          "Promos de aliados" en su Perfil — el alcance se ajusta
          automáticamente.
        </p>
      </div>
        </section>

        <section class="rounded-2xl border border-stroke bg-surface p-5">
          <h2
            class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
          >
            <span class="h-4 w-1 rounded-full bg-accent" />
            Programación
          </h2>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Fecha</span
              >
              <UPopover class="mt-1">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  class="w-full justify-start"
                >
                  {{
                    scheduledDate
                      ? scheduleFormatter.format(
                          scheduledDate.toDate(getLocalTimeZone()),
                        )
                      : 'Selecciona fecha'
                  }}
                </UButton>
                <template #content>
                  <UCalendar
                    v-model="scheduledDate"
                    :min-value="minScheduleDate"
                    class="p-2"
                  />
                </template>
              </UPopover>
            </div>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Hora</span
              >
              <input
                v-model="form.time"
                type="time"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
              />
            </label>
          </div>
          <p class="mt-3 text-[10px] font-semibold text-text-dim">
            {{
              scheduledLabel
                ? `Programada para el ${scheduledLabel}`
                : 'Sin programar — queda como borrador y la lanzas manualmente desde CMS.'
            }}
          </p>
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
        Así llegará al socio
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

            <!-- Lock screen -->
            <div class="flex flex-1 flex-col px-2.5 pt-14">
              <Lock class="mx-auto h-3.5 w-3.5 text-text-dim" />
              <p
                class="mt-1 text-center text-3xl font-black tracking-tight text-text-primary"
              >
                9:41
              </p>
              <p
                class="text-center text-[9px] font-semibold uppercase tracking-widest text-text-dim"
              >
                lunes 6 de octubre
              </p>

              <!-- Notification banner -->
              <div
                class="mt-5 rounded-2xl border border-white/10 bg-surface/80 p-2.5 shadow-lg backdrop-blur"
              >
                <div class="flex items-start gap-2">
                  <div
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent"
                  >
                    <Dumbbell class="h-3.5 w-3.5 text-base" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <p
                        class="text-[8px] font-bold uppercase tracking-widest text-text-dim"
                      >
                        RIR-HUB
                      </p>
                      <p class="text-[8px] text-text-dim">
                        {{ scheduledLabel ? 'prog. ' + (form.time || '09:00') : 'ahora' }}
                      </p>
                    </div>
                    <p
                      class="mt-0.5 text-[11px] font-bold leading-tight text-text-primary"
                    >
                      {{ form.title || 'Título de la notificación' }}
                    </p>
                    <p class="text-[10px] leading-snug text-text-muted">
                      {{ form.body || 'Mensaje para los socios…' }}
                    </p>
                  </div>
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
            <Save class="h-4 w-4" />
            {{ saving ? 'Guardando…' : 'Guardar notificación' }}
          </button>
        </section>
      </div>
    </div>

    <UModal
      v-model:open="confirmModalOpen"
      title="Guardar notificación"
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
  </div>
</template>
