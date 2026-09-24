<script setup lang="ts">
import {
  Layers,
  PauseCircle,
  PlayCircle,
  Plus,
  TimerOff,
} from '@lucide/vue';

import type { Branch, SponsorAd } from '#shared/types';

const { ads, pending, load } = useCms();
const { session } = useAuth();
/// El inventario publicitario es comercial/global — solo el admin lo edita.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const branches = ref<Branch[]>([]);

type AdFilter = 'todas' | 'ACTIVE' | 'PAUSED' | 'expiring';
const adFilter = ref<AdFilter>('todas');

const WEEK_MS = 7 * 86_400_000;

function isExpiring(ad: SponsorAd): boolean {
  return ad.endsAt - Date.now() <= WEEK_MS;
}

/// La app oculta anuncios vencidos aunque status siga ACTIVE.
function isExpired(ad: SponsorAd): boolean {
  return ad.endsAt < Date.now();
}

/// Realmente visibles en la app — activos y vigentes (la app filtra por ends_at).
const activeAds = computed(() =>
  ads.value.filter((a) => a.status === 'ACTIVE' && !isExpired(a)),
);
const pausedAds = computed(() => ads.value.filter((a) => a.status === 'PAUSED'));
const expiringAds = computed(() => ads.value.filter(isExpiring));
const totalImpressions = computed(() =>
  ads.value.reduce((sum, a) => sum + a.impressions, 0),
);
const totalTaps = computed(() =>
  ads.value.reduce((sum, a) => sum + a.taps, 0),
);
const globalCtr = computed(() =>
  totalImpressions.value > 0
    ? ((totalTaps.value / totalImpressions.value) * 100).toFixed(1)
    : '0',
);

const filteredAds = computed(() => {
  switch (adFilter.value) {
    case 'ACTIVE':
      return activeAds.value;
    case 'PAUSED':
      return pausedAds.value;
    case 'expiring':
      return expiringAds.value;
    default:
      return ads.value;
  }
});

function toggleFilter(key: AdFilter): void {
  adFilter.value = adFilter.value === key ? 'todas' : key;
}

function adCtr(ad: SponsorAd): string {
  if (ad.impressions === 0) return '—';
  return `${((ad.taps / ad.impressions) * 100).toFixed(1)}%`;
}

function branchName(id: string | null): string {
  if (!id) return 'Todas las sedes';
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  });
}

onMounted(async () => {
  await load();
  try {
    branches.value = await $api<Branch[]>('/api/branches');
  } catch {
    branches.value = [];
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          adFilter === 'todas'
            ? 'border-accent bg-accent/10'
            : 'border-stroke bg-surface hover:border-accent/50'
        "
        @click="toggleFilter('todas')"
      >
        <div class="flex items-center gap-2">
          <Layers class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Todos los anuncios
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ ads.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          {{ totalImpressions.toLocaleString('es-MX') }} imp ·
          {{ globalCtr }}% CTR
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          adFilter === 'ACTIVE'
            ? 'border-emerald-400 bg-emerald-400/10'
            : 'border-stroke bg-surface hover:border-emerald-400/50'
        "
        @click="toggleFilter('ACTIVE')"
      >
        <div class="flex items-center gap-2">
          <PlayCircle class="h-4 w-4 text-emerald-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Activos
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-emerald-400">
          {{ activeAds.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          visibles en la app ahora
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          adFilter === 'PAUSED'
            ? 'border-white/40 bg-white/5'
            : 'border-stroke bg-surface hover:border-white/30'
        "
        @click="toggleFilter('PAUSED')"
      >
        <div class="flex items-center gap-2">
          <PauseCircle class="h-4 w-4 text-text-muted" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Pausados
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ pausedAds.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          sin impresiones nuevas
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          adFilter === 'expiring'
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-stroke bg-surface hover:border-amber-400/50'
        "
        @click="toggleFilter('expiring')"
      >
        <div class="flex items-center gap-2">
          <TimerOff class="h-4 w-4 text-amber-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Por vencer
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-amber-400">
          {{ expiringAds.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          vencen en ≤7 días
        </p>
      </button>
    </div>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2
            class="text-sm font-black uppercase tracking-widest text-text-muted"
          >
            Inventario publicitario
          </h2>
          <p class="mt-0.5 text-[10px] font-semibold text-accent">
            Espacios vendibles — Carrusel del Home o directorio de Aliados
          </p>
        </div>
        <button
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
          @click="navigateTo('/publicidad/nuevo')"
        >
          <Plus class="h-3.5 w-3.5" />
          Nuevo anuncio
        </button>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Anuncio</th>
              <th class="px-5 py-3 font-bold">Espacio</th>
              <th class="px-5 py-3 font-bold">Sede</th>
              <th class="px-5 py-3 font-bold">Vigencia</th>
              <th class="px-5 py-3 font-bold">Estado</th>
              <th class="px-5 py-3 font-bold">Impresiones</th>
              <th class="px-5 py-3 font-bold">Taps</th>
              <th class="px-5 py-3 text-right font-bold">CTR</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ad in filteredAds"
              :key="ad.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <img
                    :src="ad.imageUrl"
                    :alt="ad.title"
                    class="h-9 w-14 rounded-lg border border-stroke object-cover"
                  />
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span
                        v-if="argbToHex(ad.brandColor)"
                        class="h-2.5 w-2.5 shrink-0 rounded-full"
                        :style="{ backgroundColor: argbToHex(ad.brandColor) ?? '' }"
                        :title="`Color de marca: ${argbToHex(ad.brandColor)}`"
                      />
                      <button
                        type="button"
                        class="block max-w-full cursor-pointer truncate text-xs font-bold text-text-primary transition hover:text-accent hover:underline"
                        @click="navigateTo(`/publicidad/${ad.id}`)"
                      >
                        {{ ad.advertiser }}
                      </button>
                    </div>
                    <p class="truncate text-[10px] text-text-dim">
                      {{ ad.title }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                  :class="
                    ad.placement === 'carousel'
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-stroke bg-base text-text-muted'
                  "
                >
                  {{ ad.placement === 'carousel' ? 'CARRUSEL' : 'DIRECTORIO' }}
                </span>
              </td>
              <td class="px-5 py-3 text-[11px] text-text-muted">
                {{ branchName(ad.branchId) }}
              </td>
              <td
                class="px-5 py-3 font-mono text-[10px]"
                :class="isExpired(ad) ? 'font-bold text-red-400' : 'text-text-dim'"
              >
                {{ formatDay(ad.endsAt) }}
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                  :class="
                    isExpired(ad)
                      ? 'border-red-400/40 bg-red-400/10 text-red-400'
                      : ad.status === 'ACTIVE'
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                        : 'border-stroke bg-base text-text-dim'
                  "
                >
                  {{
                    isExpired(ad)
                      ? 'VENCIDO'
                      : ad.status === 'ACTIVE'
                        ? 'ACTIVO'
                        : 'PAUSADO'
                  }}
                </span>
              </td>
              <td class="px-5 py-3 text-[11px] font-bold text-text-primary">
                {{ ad.impressions.toLocaleString('es-MX') }}
              </td>
              <td class="px-5 py-3 text-[11px] font-bold text-text-primary">
                {{ ad.taps.toLocaleString('es-MX') }}
              </td>
              <td class="px-5 py-3 text-right">
                <span
                  class="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black text-accent"
                >
                  {{ adCtr(ad) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!pending && filteredAds.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          {{
            adFilter === 'todas'
              ? 'Sin anuncios de aliados'
              : 'Sin anuncios en este filtro'
          }}
        </p>
      </div>
    </section>
  </div>
</template>
