<script setup lang="ts">
import { ArrowLeft, Check, Copy, Link2, Settings2 } from '@lucide/vue';

import type { AdSelfServeConfig, Branch, SponsorAd } from '#shared/types';

const { adsConfig, loadAdsConfig, saveAdsConfig } = useCms();
const { session } = useAuth();

const branches = ref<Branch[]>([]);
const configDraft = ref<AdSelfServeConfig | null>(null);
const saving = ref(false);
const saved = ref(false);
const saveError = ref<string | null>(null);
const linkCopied = ref(false);

const selfServeUrl = computed(() =>
  import.meta.client ? `${window.location.origin}/anuncia` : '/anuncia',
);

const slotMeta: Record<SponsorAd['placement'], { label: string; hint: string }> = {
  carousel: { label: 'Carrusel del Home', hint: 'Banner premium del Home' },
  list: { label: 'Directorio de Aliados', hint: 'Listado en Aliados' },
  both: { label: 'Home + Aliados', hint: 'Combo — sale en ambas superficies' },
};

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
          both: { enabled: true, pricePerWeek: 650 },
        },
      };
  /// Docs viejos de /config/ads no tienen el bloque notify.
  configDraft.value!.notify ??= { global: [], byBranch: {} };
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
            @click="configDraft.enabled = !configDraft.enabled"
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
            v-for="slot in (['carousel', 'list', 'both'] as const)"
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
                @click="
                  configDraft.slots[slot].enabled =
                    configDraft.slots[slot].enabled === false
                "
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
                MXN/semana/sede
              </span>
            </div>
          </div>
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
          Si compran una sede avisa solo a su correo; si compran todas, avisa
          a todos.
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
  </div>
</template>
