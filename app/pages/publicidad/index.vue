<script setup lang="ts">
import {
  Check,
  Hourglass,
  Layers,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings2,
  TimerOff,
  Undo2,
} from '@lucide/vue';

import type { AdOrder, SponsorAd } from '#shared/types';

const {
  ads,
  orders,
  adsConfig,
  pending,
  load,
  loadOrders,
  loadAdsConfig,
  approveOrder,
  rejectOrder,
} = useCms();
const { session } = useAuth();
/// El inventario publicitario es comercial/global — solo el admin lo edita.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

/// Revisión de órdenes pagadas — los anuncios ya no se venden por sede,
/// toda orden es global (branchId null) → aprobar es admin-only.
function canReviewOrder(_order: AdOrder): boolean {
  return isAdmin.value;
}

type AdFilter = 'todas' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'expiring';
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
/// Comprados por self-serve, esperando revisión del admin.
const pendingAds = computed(() =>
  ads.value.filter((a) => a.status === 'PENDING'),
);
const expiringAds = computed(() =>
  ads.value.filter((a) => a.status !== 'PENDING' && isExpiring(a)),
);
const pendingOrders = computed(() =>
  orders.value.filter((o) => o.status === 'PENDING_APPROVAL'),
);
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
    case 'PENDING':
      return pendingAds.value;
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


function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  });
}

// ── Revisión de órdenes self-serve ──

const orderError = ref<string | null>(null);
const processingOrder = ref<string | null>(null);
const rejectTarget = ref<AdOrder | null>(null);
const rejectReason = ref('');
const rejecting = ref(false);

async function approve(order: AdOrder): Promise<void> {
  if (processingOrder.value) return;
  processingOrder.value = order.id;
  orderError.value = null;
  try {
    await approveOrder(order);
  } catch (cause) {
    orderError.value =
      cause instanceof Error ? cause.message : 'No se pudo aprobar';
  } finally {
    processingOrder.value = null;
  }
}

function askReject(order: AdOrder): void {
  rejectTarget.value = order;
  rejectReason.value = '';
  orderError.value = null;
}

async function confirmReject(): Promise<void> {
  if (!rejectTarget.value || rejecting.value) return;
  rejecting.value = true;
  try {
    await rejectOrder(rejectTarget.value, rejectReason.value);
    rejectTarget.value = null;
  } catch (cause) {
    orderError.value =
      cause instanceof Error ? cause.message : 'No se pudo reembolsar';
    rejectTarget.value = null;
  } finally {
    rejecting.value = false;
  }
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('es-MX')} MXN`;
}

function placementName(p: AdOrder['placement']): string {
  return p === 'carousel' ? 'Carrusel destacado' : 'Directorio de Aliados';
}

onMounted(async () => {
  await Promise.all([load(), loadOrders(), loadAdsConfig()]);
});
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <button
        v-if="pendingOrders.length"
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          adFilter === 'PENDING'
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-amber-400/50 bg-amber-400/5 hover:border-amber-400'
        "
        @click="toggleFilter('PENDING')"
      >
        <div class="flex items-center gap-2">
          <Hourglass class="h-4 w-4 text-amber-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-amber-400"
          >
            Por aprobar
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-amber-400">
          {{ pendingOrders.length }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          ya pagaron — esperan tu revisión
        </p>
      </button>
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

    <!-- Solicitudes self-serve pagadas — el gym solo aprueba o reembolsa -->
    <section
      v-if="pendingOrders.length"
      class="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5"
    >
      <div class="flex items-center justify-between">
        <h2
          class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-amber-400"
        >
          <Hourglass class="h-4 w-4" />
          Solicitudes de anuncios pagados
        </h2>
        <p class="text-[10px] font-semibold text-text-dim">
          Aprueba para publicar · Rechaza para reembolsar automáticamente
        </p>
      </div>
      <p
        v-if="orderError"
        class="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-400"
      >
        {{ orderError }}
      </p>
      <div class="mt-4 space-y-3">
        <div
          v-for="order in pendingOrders"
          :key="order.id"
          class="flex flex-col gap-3 rounded-xl border border-stroke bg-surface p-4 sm:flex-row sm:items-center"
        >
          <img
            :src="order.imageUrl"
            :alt="order.title"
            class="h-12 w-20 shrink-0 rounded-lg border border-stroke object-cover"
          />
          <div class="min-w-0 flex-1">
            <button
              v-if="order.sponsorAdId"
              type="button"
              class="cursor-pointer truncate text-sm font-black text-text-primary transition hover:text-accent hover:underline"
              @click="navigateTo(`/publicidad/${order.sponsorAdId}`)"
            >
              {{ order.businessName }}
            </button>
            <p v-else class="truncate text-sm font-black text-text-primary">
              {{ order.businessName }}
            </p>
            <p class="truncate text-[11px] text-text-dim">
              {{ order.title }} — {{ order.contactName }} · {{ order.email }}
            </p>
            <p class="mt-1 text-[10px] font-bold text-text-muted">
              {{ placementName(order.placement) }} ·
              {{ order.weeks }} semana{{ order.weeks > 1 ? 's' : '' }} ·
              todas las sedes ·
              <span class="text-emerald-400">
                pagó {{ formatMoney(order.amount) }}
              </span>
              <span
                v-if="order.wantsPush"
                class="ml-1.5 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-accent"
                title="Compró paquete de pushes extra — el incluido sale al aprobar y los extra van 1 por semana"
              >
                + Push ×{{ order.pushPack || 1 }}
              </span>
            </p>
          </div>
          <div v-if="canReviewOrder(order)" class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-black text-emerald-400 transition hover:bg-emerald-400/20 disabled:opacity-50"
              :disabled="processingOrder === order.id"
              @click="approve(order)"
            >
              <Check class="h-3.5 w-3.5" />
              {{ processingOrder === order.id ? 'Publicando…' : 'Aprobar' }}
            </button>
            <button
              type="button"
              class="flex cursor-pointer items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-4 py-1.5 text-[11px] font-black text-red-400 transition hover:bg-red-400/20 disabled:opacity-50"
              :disabled="!!processingOrder"
              @click="askReject(order)"
            >
              <Undo2 class="h-3.5 w-3.5" />
              Rechazar
            </button>
          </div>
        </div>
      </div>
    </section>

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
        <div class="flex items-center gap-2">
          <button
            v-if="isAdmin"
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-4 py-1.5 text-[11px] font-black text-text-muted transition hover:border-accent/50 hover:text-text-primary"
            @click="navigateTo('/publicidad/venta-directa')"
          >
            <Settings2 class="h-3.5 w-3.5" />
            Venta directa
            <span
              class="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase"
              :class="
                adsConfig?.enabled
                  ? 'bg-emerald-400/15 text-emerald-400'
                  : 'bg-base text-text-dim'
              "
            >
              {{ adsConfig?.enabled ? 'ON' : 'OFF' }}
            </span>
          </button>
          <button
            v-if="isAdmin"
            class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
            @click="navigateTo('/publicidad/nuevo')"
          >
            <Plus class="h-3.5 w-3.5" />
            Nuevo anuncio
          </button>
        </div>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Anuncio</th>
              <th class="px-5 py-3 font-bold">Espacio</th>
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
                    ad.placement !== 'list'
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-stroke bg-base text-text-muted'
                  "
                >
                  {{ ad.placement === 'carousel' ? 'CARRUSEL' : 'DIRECTORIO' }}
                </span>
              </td>
              <td
                class="px-5 py-3 font-mono text-[10px]"
                :class="
                  ad.status === 'PENDING'
                    ? 'text-amber-400'
                    : isExpired(ad)
                      ? 'font-bold text-red-400'
                      : 'text-text-dim'
                "
              >
                {{ ad.status === 'PENDING' ? 'al aprobar' : formatDay(ad.endsAt) }}
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                  :class="
                    ad.status === 'PENDING'
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                      : isExpired(ad)
                        ? 'border-red-400/40 bg-red-400/10 text-red-400'
                        : ad.status === 'ACTIVE'
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                          : 'border-stroke bg-base text-text-dim'
                  "
                >
                  {{
                    ad.status === 'PENDING'
                      ? 'EN REVISIÓN'
                      : isExpired(ad)
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

    <!-- Rechazo de orden — con reembolso automático -->
    <UModal
      :open="!!rejectTarget"
      title="Rechazar y reembolsar"
      :description="`Se reembolsará ${rejectTarget ? formatMoney(rejectTarget.amount) : ''} a ${rejectTarget?.businessName ?? ''} y el anuncio no se publicará.`"
      @update:open="rejectTarget = null"
    >
      <template #body>
        <textarea
          v-model="rejectReason"
          rows="2"
          placeholder="Motivo del rechazo (opcional — se envía al anunciante por correo)"
          class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="rejectTarget = null"
          />
          <UButton
            label="Rechazar y reembolsar"
            color="primary"
            :loading="rejecting"
            @click="confirmReject"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
