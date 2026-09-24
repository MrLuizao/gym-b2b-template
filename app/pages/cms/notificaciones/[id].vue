<script setup lang="ts">
import {
  ArrowLeft,
  BatteryFull,
  Dumbbell,
  Lock,
  Save,
  Send,
  Signal,
  Trash2,
  Wifi,
} from '@lucide/vue';
import type { Branch, PushLog } from '#shared/types';

const route = useRoute();
const router = useRouter();
const { session } = useAuth();
/// Push = contenido comercial global — solo el admin la gestiona.
const isAdmin = computed(() => session.value?.role === 'ADMIN');
const { updatePush, deletePush, sendPush } = useCms();

const push = ref<PushLog | null>(null);
const branches = ref<Branch[]>([]);
const pending = ref(true);
const saving = ref(false);
const sending = ref(false);
const deleting = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);
const sendModalOpen = ref(false);
const deleteModalOpen = ref(false);

/// Borrador o envío fallido — ambos se pueden editar y (re)lanzar.
const isDraft = computed(() => {
  const s = push.value?.status;
  return s === 'DRAFT' || s === 'FAILED';
});

const statusMeta = computed(() => {
  switch (push.value?.status) {
    case 'SENT':
      return { label: 'Enviada', dot: 'bg-emerald-400', text: 'text-emerald-400' };
    case 'SENDING':
      return { label: 'Enviando…', dot: 'bg-sky-400', text: 'text-sky-400' };
    case 'FAILED':
      return { label: 'Falló', dot: 'bg-red-400', text: 'text-red-400' };
    default:
      return { label: 'Borrador', dot: 'bg-amber-400', text: 'text-amber-400' };
  }
});
/// El admin gestiona el contenido global — puede editar y eliminar
/// borradores y enviadas; el gerente solo consulta.
const canEdit = computed(() => isAdmin.value);

const form = ref({
  title: '',
  body: '',
  kind: 'BRAND' as PushLog['kind'],
  audience: 'ALL' as 'ALL' | 'BRANCH' | 'EXPIRED',
  branchId: '',
  target: 'auto' as PushLog['target'],
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

/// A dónde navega la app al tocar la notificación.
const targetOptions: { label: string; value: PushLog['target'] }[] = [
  { label: 'Automático — según el tipo', value: 'auto' },
  { label: 'Inicio', value: 'home' },
  { label: 'Explorar (clases)', value: 'explore' },
  { label: 'Aliados', value: 'allies' },
  { label: 'Descuentos', value: 'promos' },
  { label: 'Perfil', value: 'profile' },
];

const branchItems = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.id })),
);

function branchName(id: string | null): string {
  if (!id) return '—';
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

const confirmDescription = computed(
  () =>
    `Se actualizará la notificación "${form.value.title.trim()}" dirigida a ${audienceLabel.value}.`,
);

const sendDescription = computed(
  () =>
    `Se ${isDraft.value ? 'enviará' : 'reenviará'} "${form.value.title.trim()}" a ${audienceLabel.value}. Esta acción no se puede deshacer.`,
);

function validate(): boolean {
  if (missingFields.value.length > 0) {
    formError.value = `Campos obligatorios faltantes: ${missingFields.value.join(', ')}`;
    return false;
  }
  formError.value = null;
  return true;
}

function askSubmit(): void {
  if (validate()) confirmModalOpen.value = true;
}

function askSend(): void {
  if (validate()) sendModalOpen.value = true;
}

async function submit(): Promise<void> {
  if (!push.value || saving.value) return;
  saving.value = true;
  try {
    const f = form.value;
    await updatePush(push.value, {
      title: f.title.trim(),
      body: f.body.trim(),
      audience: f.audience,
      branchId: f.audience === 'BRANCH' ? f.branchId : null,
      kind: f.kind,
      target: f.target,
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

/// Guarda los cambios pendientes y lanza el envío en un solo paso.
async function submitAndSend(): Promise<void> {
  if (!push.value || sending.value) return;
  sending.value = true;
  try {
    const f = form.value;
    await updatePush(push.value, {
      title: f.title.trim(),
      body: f.body.trim(),
      audience: f.audience,
      branchId: f.audience === 'BRANCH' ? f.branchId : null,
      kind: f.kind,
      target: f.target,
    });
    await sendPush(push.value);
    sendModalOpen.value = false;
    await navigateTo('/cms');
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo enviar';
  } finally {
    sending.value = false;
  }
}

async function remove(): Promise<void> {
  if (!push.value || deleting.value) return;
  deleting.value = true;
  try {
    await deletePush(push.value);
    deleteModalOpen.value = false;
    await navigateTo('/cms');
  } finally {
    deleting.value = false;
  }
}

function formatFull(ts: number): string {
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(async () => {
  const id = route.params.id as string;
  try {
    const [p, b] = await Promise.all([
      $api<PushLog>(`/api/cms/push/${id}`),
      $api<Branch[]>('/api/branches'),
    ]);
    push.value = p;
    branches.value = b;
    form.value = {
      title: p.title,
      body: p.body,
      kind: p.kind,
      audience: p.audience,
      branchId: p.branchId ?? '',
      target: p.target,
    };
  } catch {
    push.value = null;
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
    Cargando notificación…
  </div>

  <div v-else-if="push" class="space-y-6">
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
          {{ push.title }}
        </h1>
        <p class="mt-1 text-[11px] text-text-dim">
          {{ isDraft ? 'Borrador — edítalo y lánzalo cuando quieras' : `Enviada el ${formatFull(push.createdAt)} a ${push.sent.toLocaleString('es-MX')} dispositivos` }}
        </p>
        <p class="mt-0.5 flex items-center gap-1.5">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="statusMeta.dot"
          />
          <span
            class="text-[10px] font-bold uppercase tracking-widest"
            :class="statusMeta.text"
          >
            {{ statusMeta.label }}
          </span>
        </p>
      </div>
      <button
        v-if="canEdit"
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
                :disabled="!canEdit"
                placeholder="ej. Reto de octubre"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent disabled:opacity-60"
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
                :disabled="!canEdit"
                placeholder="Mensaje para los socios…"
                class="mt-1 w-full resize-none rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent disabled:opacity-60"
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
                  :disabled="!canEdit"
                  class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition disabled:cursor-default disabled:opacity-60"
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
                :disabled="!canEdit"
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
                :disabled="!canEdit"
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
            Destino al tocarla
          </h2>
          <USelectMenu
            v-model="form.target"
            :items="targetOptions"
            value-key="value"
            :disabled="!canEdit"
            class="mt-4 w-full"
          />
          <p class="mt-3 text-[10px] font-semibold text-text-dim">
            {{
              form.target === 'auto'
                ? `Automático: ${form.kind === 'SPONSOR' ? 'Aliados' : 'Descuentos'} según el tipo.`
                : 'El socio aterriza en esa sección al abrir la notificación.'
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
                          <p class="text-[8px] text-text-dim">ahora</p>
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
                <div
                  class="mx-auto mb-2 h-1 w-24 rounded-full bg-text-dim/60"
                />
              </div>
            </div>
          </div>

          <p v-if="formError" class="mt-3 text-[11px] font-bold text-red-400">
            {{ formError }}
          </p>

          <template v-if="canEdit">
            <button
              class="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
              :disabled="saving"
              @click="askSubmit"
            >
              <Save class="h-4 w-4" />
              {{ saving ? 'Guardando…' : isDraft ? 'Guardar borrador' : 'Guardar cambios' }}
            </button>

            <button
              v-if="isDraft"
              class="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-xs font-black text-emerald-400 transition hover:bg-emerald-400/20"
              :disabled="sending"
              @click="askSend"
            >
              <Send class="h-4 w-4" />
              {{ sending ? 'Enviando…' : 'Enviar ahora' }}
            </button>
          </template>
        </section>
      </div>
    </div>

    <UModal
      v-model:open="confirmModalOpen"
      :title="isDraft ? 'Guardar borrador' : 'Guardar cambios'"
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
      v-model:open="sendModalOpen"
      :title="isDraft ? 'Enviar notificación' : 'Reenviar notificación'"
      :description="sendDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="sendModalOpen = false"
          />
          <UButton
            label="Enviar"
            icon="i-lucide-send"
            :loading="sending"
            @click="submitAndSend"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteModalOpen"
      title="Eliminar notificación"
      :description="`Se eliminará '${push.title}'. Esta acción no se puede deshacer.`"
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
    Notificación no encontrada
  </div>
</template>
