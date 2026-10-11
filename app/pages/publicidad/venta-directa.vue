<script setup lang="ts">
import { ArrowLeft, Check, Copy, Link2, Settings2, TriangleAlert } from '@lucide/vue';

import type { AdSelfServeConfig, Branch, SponsorAd } from '#shared/types';

const { adsConfig, loadAdsConfig, saveAdsConfig } = useCms();
const { session } = useAuth();

const branches = ref<Branch[]>([]);
const configDraft = ref<AdSelfServeConfig | null>(null);
const saving = ref(false);
const saved = ref(false);
const saveError = ref<string | null>(null);
const linkCopied = ref(false);
/// Confirmación de cualquier toggle de esta página (maestro, espacios,
/// push) — null = modal cerrado. `apply` muta el draft al confirmar.
interface PendingToggle {
  title: string;
  description: string;
  confirmLabel: string;
  /// Solo el toggle maestro muestra el aviso de correos faltantes.
  warnMissingNotify?: boolean;
  apply: () => void;
}
const toggleConfirm = ref<PendingToggle | null>(null);

const selfServeUrl = computed(() =>
  import.meta.client ? `${window.location.origin}/anuncia` : '/anuncia',
);

const slotMeta: Record<SponsorAd['placement'], { label: string; hint: string }> = {
  carousel: {
    label: 'Carrusel destacado',
    hint: 'Banner del Home + primeros lugares en Aliados (máx. 5 a la vez)',
  },
  list: {
    label: 'Directorio de Aliados',
    hint: 'Listado en orden aleatorio — sin favoritismo',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Sedes sin correo de aviso válido — con la venta directa prendida
/// son obligatorios (el webhook avisa al correo de la sede comprada).
const missingNotify = computed(() =>
  branches.value.filter(
    (b) => !EMAIL_RE.test(configDraft.value?.notify.byBranch[b.id] ?? ''),
  ),
);

function askToggle(): void {
  if (!configDraft.value) return;
  const on = !configDraft.value.enabled;
  toggleConfirm.value = {
    title: on ? 'Activar venta directa' : 'Apagar venta directa',
    description: on
      ? 'La página pública empezará a aceptar compras de anuncios — cada pago crea una solicitud que tú solo apruebas.'
      : 'Se dejarán de recibir solicitudes nuevas — los anuncios ya vendidos siguen su vigencia normal.',
    confirmLabel: on ? 'Activar' : 'Apagar',
    warnMissingNotify: on,
    apply: () => {
      configDraft.value!.enabled = on;
    },
  };
}

function askSlotToggle(slot: SponsorAd['placement']): void {
  const s = configDraft.value?.slots[slot];
  if (!s) return;
  const on = s.enabled === false;
  toggleConfirm.value = {
    title: `${on ? 'Activar' : 'Apagar'} ${slotMeta[slot].label}`,
    description: on
      ? 'El espacio vuelve a ser comprable en la página pública.'
      : 'Ya no se podrá comprar en /anuncia — los anuncios activos siguen su vigencia normal.',
    confirmLabel: on ? 'Activar' : 'Apagar',
    apply: () => {
      s.enabled = on;
    },
  };
}

function askPushToggle(): void {
  const p = configDraft.value?.push;
  if (!p) return;
  const on = !p.enabled;
  toggleConfirm.value = {
    title: `${on ? 'Activar' : 'Apagar'} paquete de pushes`,
    description: on
      ? 'El paquete de pushes extra se ofrece como add-on en /anuncia.'
      : 'Dejará de ofrecerse en /anuncia — los paquetes ya vendidos se siguen entregando.',
    confirmLabel: on ? 'Activar' : 'Apagar',
    apply: () => {
      p.enabled = on;
    },
  };
}

function applyToggle(): void {
  toggleConfirm.value?.apply();
  toggleConfirm.value = null;
}

/// Correos globales como texto — el modelo guarda un arreglo.
const globalNotifyText = computed({
  get: () => configDraft.value?.notify.global.join(', ') ?? '',
  set: (v: string) => {
    if (configDraft.value) {
      configDraft.value.notify.global = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  },
});

async function save(): Promise<void> {
  if (!configDraft.value || saving.value) return;
  /// Con la venta directa prendida, TODAS las sedes necesitan su correo
  /// de aviso — si falta alguna, esa compra llegaría sin notificar a nadie.
  if (configDraft.value.enabled && missingNotify.value.length > 0) {
    saveError.value =
      `Falta el correo de aviso en: ${missingNotify.value.map((b) => b.name).join(', ')}. ` +
      'Sin él, una compra de esa sede no avisaría a nadie.';
    return;
  }
  saving.value = true;
  saveError.value = null;
  try {
    await saveAdsConfig(configDraft.value);
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2500);
  } catch (cause) {
    saveError.value =
      cause instanceof Error ? cause.message : 'No se pudo guardar';
  } finally {
    saving.value = false;
  }
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(selfServeUrl.value);
    linkCopied.value = true;
    setTimeout(() => {
      linkCopied.value = false;
    }, 2000);
  } catch {
    /// Portapapeles bloqueado — el texto queda a la vista para copiar.
  }
}

onMounted(async () => {
  /// La venta directa es configuración comercial global — solo el admin.
  if (session.value?.role !== 'ADMIN') {
    await navigateTo('/publicidad');
    return;
  }
  await loadAdsConfig();
  const c = adsConfig.value;
  configDraft.value = c
    ? JSON.parse(JSON.stringify(c))
    : {
        enabled: false,
        slots: {
          carousel: { enabled: true, pricePerWeek: 500 },
          list: { enabled: true, pricePerWeek: 250 },
        },
      };
  /// Docs viejos de /config/ads no tienen los bloques notify/push.
  configDraft.value!.notify ??= { global: [], byBranch: {} };
  configDraft.value!.push ??= { enabled: false, count: 4, price: 300 };
  try {
    branches.value = await $api<Branch[]>('/api/branches');
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
      @click="navigateTo('/publicidad')"
    >
      <ArrowLeft class="h-4 w-4 text-accent" />
      Volver
    </button>

    <div class="flex items-center gap-4">
      <div
        class="flex h-20 w-32 shrink-0 items-center justify-center rounded-2xl border border-stroke bg-surface"
      >
        <Settings2 class="h-6 w-6 text-text-dim" />
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-black text-text-primary">
          Venta directa de publicidad
        </h1>
        <p class="mt-1 text-[11px] text-text-dim">
          Cualquier negocio puede comprar su anuncio en
          <span class="font-mono text-text-muted">{{ selfServeUrl }}</span>
          — sube su creativo, paga y tú solo apruebas.
        </p>
      </div>
      <span
        class="shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
        :class="
          configDraft?.enabled
            ? 'bg-emerald-400/15 text-emerald-400'
            : 'bg-base text-text-dim'
        "
      >
        {{ configDraft?.enabled ? 'Activa' : 'Apagada' }}
      </span>
    </div>

    <div v-if="configDraft" class="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      <div class="space-y-6">
      <section class="rounded-2xl border border-stroke bg-surface p-5">
        <h2
          class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
        >
          <span class="h-4 w-1 rounded-full bg-accent" />
          Estado
        </h2>
        <div
          class="mt-4 flex items-center justify-between rounded-xl border border-stroke bg-base px-4 py-3"
        >
          <div>
            <p class="text-xs font-black text-text-primary">
              Venta directa activa
            </p>
            <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
              Apágala si no quieres recibir solicitudes nuevas
            </p>
          </div>
          <button
            type="button"
            class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition"
            :class="
              configDraft.enabled ? 'bg-accent' : 'border border-stroke bg-base'
            "
            @click="askToggle"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="
                configDraft.enabled ? 'left-[22px] bg-base' : 'left-0.5 bg-white'
              "
            />
          </button>
        </div>
      </section>

      <section class="rounded-2xl border border-stroke bg-surface p-5">
        <h2
          class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
        >
          <span class="h-4 w-1 rounded-full bg-accent" />
          Precios por espacio
        </h2>
        <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
          Un espacio apagado no se puede comprar en la página pública
        </p>
        <div class="mt-4 space-y-3">
          <div
            v-for="slot in (['carousel', 'list'] as const)"
            :key="slot"
            class="flex items-center justify-between gap-3 rounded-xl border border-stroke bg-base px-4 py-3"
          >
            <div class="flex min-w-0 items-center gap-3">
              <button
                type="button"
                class="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition"
                :class="
                  configDraft.slots[slot].enabled !== false
                    ? 'bg-accent'
                    : 'border border-stroke bg-surface'
                "
                @click="askSlotToggle(slot)"
              >
                <span
                  class="absolute top-0.5 h-4 w-4 rounded-full transition-all"
                  :class="
                    configDraft.slots[slot].enabled !== false
                      ? 'left-[18px] bg-base'
                      : 'left-0.5 bg-white'
                  "
                />
              </button>
              <div class="min-w-0">
                <p class="text-xs font-black text-text-primary">
                  {{ slotMeta[slot].label }}
                </p>
                <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
                  {{ slotMeta[slot].hint }}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <input
                v-model.number="configDraft.slots[slot].pricePerWeek"
                type="number"
                min="0"
                step="50"
                class="w-24 rounded-lg border border-stroke bg-surface px-2 py-1.5 text-right text-xs font-bold text-text-primary outline-none focus:border-accent"
              />
              <span class="text-[10px] font-bold text-text-dim">
                MXN/semana
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-stroke bg-surface p-5">
        <h2
          class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
        >
          <span class="h-4 w-1 rounded-full bg-accent" />
          Notificaciones push
        </h2>
        <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
          Toda compra incluye 1 push GRATIS que sale al aprobar el anuncio.
          El paquete extra se envía 1 por semana durante la campaña
          (cron diario /api/cron/push-dispatch).
        </p>
        <div
          class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-stroke bg-base px-4 py-3"
        >
          <div class="flex min-w-0 items-center gap-3">
            <button
              type="button"
              class="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition"
              :class="
                configDraft.push.enabled
                  ? 'bg-accent'
                  : 'border border-stroke bg-surface'
              "
              @click="askPushToggle"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full transition-all"
                :class="
                  configDraft.push.enabled
                    ? 'left-[18px] bg-base'
                    : 'left-0.5 bg-white'
                "
              />
            </button>
            <div class="min-w-0">
              <p class="text-xs font-black text-text-primary">
                Paquete de pushes extra
              </p>
              <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
                Se ofrece como add-on en /anuncia, para cualquier espacio
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <input
              v-model.number="configDraft.push.count"
              type="number"
              min="1"
              max="52"
              step="1"
              class="w-16 rounded-lg border border-stroke bg-surface px-2 py-1.5 text-right text-xs font-bold text-text-primary outline-none focus:border-accent"
            />
            <span class="text-[10px] font-bold text-text-dim">pushes</span>
          </div>
        </div>
        <div
          class="mt-3 flex items-center justify-end gap-2 rounded-xl border border-stroke bg-base px-4 py-3"
        >
          <span class="mr-auto text-[11px] font-black text-text-muted">
            Precio del paquete
          </span>
          <input
            v-model.number="configDraft.push.price"
            type="number"
            min="0"
            step="50"
            class="w-24 rounded-lg border border-stroke bg-surface px-2 py-1.5 text-right text-xs font-bold text-text-primary outline-none focus:border-accent"
          />
          <span class="text-[10px] font-bold text-text-dim">
            MXN · único
          </span>
        </div>
      </section>
      </div>

      <div class="space-y-6">
      <section class="rounded-2xl border border-stroke bg-surface p-5">
        <h2
          class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
        >
          <span class="h-4 w-1 rounded-full bg-accent" />
          Avisos por correo
        </h2>
        <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
          Además del admin, ¿quién recibe el aviso de cada solicitud pagada?
          Toda compra es para todas las sedes — los correos configurados por
          sede reciben aviso siempre.
        </p>
        <div class="mt-4 space-y-3">
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Correos globales</span
            >
            <input
              v-model="globalNotifyText"
              type="text"
              placeholder="Correos separados por coma — reciben TODAS las solicitudes"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim/60 focus:border-accent"
            />
          </label>
          <div
            v-for="b in branches"
            :key="b.id"
            class="flex items-center gap-3"
          >
            <span
              class="w-28 shrink-0 truncate text-[11px] font-black text-text-muted"
              :title="b.name"
            >
              {{ b.name }}
            </span>
            <input
              v-model="configDraft.notify.byBranch[b.id]"
              type="email"
              placeholder="correo de la sede"
              class="min-w-0 flex-1 rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim/60 focus:border-accent"
            />
          </div>
          <p
            v-if="configDraft.enabled && missingNotify.length"
            class="flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-400"
          >
            <TriangleAlert class="h-3.5 w-3.5 shrink-0" />
            Falta correo en: {{ missingNotify.map((b) => b.name).join(', ') }}
          </p>
        </div>
      </section>

      <section class="rounded-2xl border border-stroke bg-surface p-5">
        <h2
          class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
        >
          <span class="h-4 w-1 rounded-full bg-accent" />
          Liga pública
        </h2>
        <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
          Compártela con negocios interesados — redes, correo, QR impreso
        </p>
        <div
          class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-stroke bg-base px-4 py-3"
        >
          <div class="flex min-w-0 items-center gap-2">
            <Link2 class="h-3.5 w-3.5 shrink-0 text-text-dim" />
            <p class="truncate font-mono text-[11px] text-text-muted">
              {{ selfServeUrl }}
            </p>
          </div>
          <button
            type="button"
            class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1.5 text-[10px] font-black text-text-muted transition hover:border-accent/50 hover:text-text-primary"
            @click="copyLink"
          >
            <Copy class="h-3 w-3" />
            {{ linkCopied ? 'Copiado' : 'Copiar' }}
          </button>
        </div>
      </section>
      </div>
    </div>

    <div
      v-if="configDraft"
      class="flex flex-wrap items-center gap-3 border-t border-stroke pt-4 pb-2"
    >
      <p
        v-if="saveError"
        class="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-400"
      >
        {{ saveError }}
      </p>
      <button
        type="button"
        class="flex-1 cursor-pointer rounded-full border border-stroke px-5 py-2 text-[11px] font-black text-text-muted transition hover:border-accent/50 hover:text-text-primary"
        @click="navigateTo('/publicidad')"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-accent px-5 py-2 text-[11px] font-black text-base transition hover:opacity-90 disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        <Check v-if="saved" class="h-3.5 w-3.5" />
        {{ saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios' }}
      </button>
    </div>

    <!-- Confirmación de cualquier toggle — activar o apagar -->
    <UModal
      :open="toggleConfirm !== null"
      :title="toggleConfirm?.title ?? ''"
      :description="toggleConfirm?.description"
      @update:open="toggleConfirm = null"
    >
      <template #body>
        <p
          v-if="toggleConfirm?.warnMissingNotify && missingNotify.length"
          class="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[11px] font-bold text-amber-400"
        >
          <TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ojo — faltan correos de aviso en
          {{ missingNotify.map((b) => b.name).join(', ') }}. Complétalos
          antes de guardar o no podrás activar.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            class="flex-1 justify-center"
            @click="toggleConfirm = null"
          />
          <UButton
            :label="toggleConfirm?.confirmLabel ?? 'Confirmar'"
            color="primary"
            class="flex-1 justify-center"
            @click="applyToggle"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
