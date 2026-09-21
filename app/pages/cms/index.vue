<script setup lang="ts">
import {
  BellRing,
  Dumbbell,
  ImageUp,
  Images,
  Plus,
  Send,
  TicketPercent,
} from '@lucide/vue';

import type { Branch, MembershipLevel } from '#shared/types';

const {
  promos,
  coupons,
  pushes,
  pending,
  load,
  createPromo,
  createCoupon,
  sendPush,
} = useCms();

const branches = ref<Branch[]>([]);

const bannerModalOpen = ref(false);
const couponModalOpen = ref(false);
const pushModalOpen = ref(false);

const bannerTitle = ref('');
const bannerSubtitle = ref('');
const bannerBadge = ref('NUEVO');
const bannerImage = ref('');
const bannerBranch = ref('todas');

const couponTitle = ref('');
const couponDescription = ref('');
const couponBadge = ref('-25%');
const couponCode = ref('');
const couponLevels = ref<MembershipLevel[]>(['CLASSIC', 'PLUS', 'BLACK']);
const couponBranch = ref('todas');

const pushTitle = ref('');
const pushBody = ref('');
const pushAudience = ref<'ALL' | 'BRANCH' | 'EXPIRED'>('ALL');
const pushBranch = ref('todas');

const bannerError = ref<string | null>(null);
const couponError = ref<string | null>(null);
const pushError = ref<string | null>(null);
const pushResult = ref<string | null>(null);

const LEVEL_OPTIONS: MembershipLevel[] = ['CLASSIC', 'PLUS', 'BLACK'];

const branchItems = computed(() => [
  { label: 'Todas las sedes', value: 'todas' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

const branchOnlyItems = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.id })),
);

const audienceItems = [
  { label: 'Todos los socios', value: 'ALL' },
  { label: 'Por sucursal', value: 'BRANCH' },
  { label: 'Membresías vencidas', value: 'EXPIRED' },
];

const confirmOpen = ref(false);
const confirmTitle = ref('');
const confirmDescription = ref('');
const confirmAction = ref<(() => Promise<void>) | null>(null);
const confirming = ref(false);

function askConfirm(
  title: string,
  description: string,
  action: () => Promise<void>,
): void {
  confirmTitle.value = title;
  confirmDescription.value = description;
  confirmAction.value = action;
  confirmOpen.value = true;
}

async function runConfirm(): Promise<void> {
  if (!confirmAction.value || confirming.value) return;
  confirming.value = true;
  try {
    await confirmAction.value();
    confirmOpen.value = false;
  } finally {
    confirming.value = false;
  }
}

const totalReach = computed(() =>
  pushes.value.reduce((sum, log) => sum + log.sent, 0),
);

function branchName(id: string | null): string {
  if (!id) return 'Todas las sedes';
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toggleLevel(level: MembershipLevel): void {
  couponLevels.value = couponLevels.value.includes(level)
    ? couponLevels.value.filter((item) => item !== level)
    : [...couponLevels.value, level];
}

function submitBanner(): void {
  if (!bannerTitle.value.trim() || !bannerSubtitle.value.trim()) {
    bannerError.value = 'Título y subtítulo son obligatorios';
    return;
  }
  bannerError.value = null;
  askConfirm(
    'Publicar banner',
    `Se publicará "${bannerTitle.value.trim()}" en el feed de promociones de la app (${branchName(bannerBranch.value === 'todas' ? null : bannerBranch.value)}).`,
    async () => {
      try {
        await createPromo({
          title: bannerTitle.value.trim(),
          subtitle: bannerSubtitle.value.trim(),
          badge: bannerBadge.value.trim() || 'NUEVO',
          imageUrl: bannerImage.value.trim(),
          branchId:
            bannerBranch.value === 'todas' ? null : bannerBranch.value,
        });
        bannerTitle.value = '';
        bannerSubtitle.value = '';
        bannerBadge.value = '';
        bannerImage.value = '';
        bannerBranch.value = 'todas';
        bannerModalOpen.value = false;
      } catch (cause) {
        bannerError.value =
          cause instanceof Error ? cause.message : 'No se pudo publicar';
      }
    },
  );
}

function submitCoupon(): void {
  if (!couponTitle.value.trim() || !couponCode.value.trim()) {
    couponError.value = 'Título y código son obligatorios';
    return;
  }
  if (couponLevels.value.length === 0) {
    couponError.value = 'Selecciona al menos un nivel';
    return;
  }
  couponError.value = null;
  askConfirm(
    'Crear cupón',
    `Se creará el cupón "${couponTitle.value.trim()}" (${couponCode.value.trim().toUpperCase()}) para niveles ${couponLevels.value.join(', ')} · ${branchName(couponBranch.value === 'todas' ? null : couponBranch.value)}.`,
    async () => {
      try {
        await createCoupon({
          title: couponTitle.value.trim(),
          description: couponDescription.value.trim(),
          badge: couponBadge.value.trim() || 'NUEVO',
          code: couponCode.value.trim().toUpperCase(),
          levels: couponLevels.value,
          branchId:
            couponBranch.value === 'todas' ? null : couponBranch.value,
        });
        couponTitle.value = '';
        couponDescription.value = '';
        couponBadge.value = '';
        couponCode.value = '';
        couponLevels.value = [...LEVEL_OPTIONS];
        couponBranch.value = 'todas';
        couponModalOpen.value = false;
      } catch (cause) {
        couponError.value =
          cause instanceof Error ? cause.message : 'No se pudo crear el cupón';
      }
    },
  );
}

function submitPush(): void {
  if (!pushTitle.value.trim() || !pushBody.value.trim()) {
    pushError.value = 'Completa título y mensaje';
    return;
  }
  pushError.value = null;
  pushResult.value = null;
  const audienceLabel =
    pushAudience.value === 'ALL'
      ? 'todos los socios'
      : pushAudience.value === 'EXPIRED'
        ? 'socios con membresía vencida'
        : `los socios de ${branchName(pushBranch.value === 'todas' ? null : pushBranch.value)}`;
  askConfirm(
    'Enviar notificación push',
    `Se enviará "${pushTitle.value.trim()}" a ${audienceLabel}.`,
    async () => {
      try {
        const log = await sendPush({
          title: pushTitle.value.trim(),
          body: pushBody.value.trim(),
          audience: pushAudience.value,
          branchId:
            pushAudience.value === 'BRANCH' && pushBranch.value !== 'todas'
              ? pushBranch.value
              : null,
        });
        pushResult.value = `Notificación enviada a ${log.sent.toLocaleString('es-BO')} dispositivos`;
        pushTitle.value = '';
        pushBody.value = '';
        pushModalOpen.value = false;
      } catch (cause) {
        pushError.value =
          cause instanceof Error ? cause.message : 'No se pudo enviar';
      }
    },
  );
}

onMounted(async () => {
  await load();
  try {
    branches.value = await $fetch<Branch[]>('/api/branches');
  } catch {
    branches.value = [];
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <TicketPercent class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Cupones activos
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ coupons.length }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Images class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Banners publicados
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ promos.length }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <BellRing class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Push enviadas
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ pushes.length }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Send class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Alcance total
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ totalReach.toLocaleString('es-BO') }}
        </p>
      </div>
    </div> -->

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Cupones
        </h2>
        <button
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
          @click="couponModalOpen = true"
        >
          <Plus class="h-3.5 w-3.5" />
          Nuevo cupón
        </button>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Cupón</th>
              <th class="px-5 py-3 font-bold">Código</th>
              <th class="px-5 py-3 font-bold">Niveles</th>
              <th class="px-5 py-3 font-bold">Sede</th>
              <th class="px-5 py-3 text-right font-bold">Publicado</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="coupon in coupons"
              :key="coupon.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <span
                    class="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-black text-accent"
                  >
                    {{ coupon.badge }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-xs font-bold text-text-primary">
                      {{ coupon.title }}
                    </p>
                    <p class="truncate text-[10px] text-text-dim">
                      {{ coupon.description }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-lg border border-stroke bg-base px-2 py-0.5 font-mono text-[10px] font-black text-accent"
                >
                  {{ coupon.code }}
                </span>
              </td>
              <td class="px-5 py-3">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="level in coupon.levels"
                    :key="level"
                    class="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-text-muted"
                  >
                    {{ level }}
                  </span>
                </div>
              </td>
              <td class="px-5 py-3 text-[11px] text-text-muted">
                {{ branchName(coupon.branchId) }}
              </td>
              <td
                class="px-5 py-3 text-right font-mono text-[10px] text-text-dim"
              >
                {{ formatDate(coupon.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!pending && coupons.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          Sin cupones publicados
        </p>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Banners
        </h2>
        <button
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
          @click="bannerModalOpen = true"
        >
          <Plus class="h-3.5 w-3.5" />
          Nuevo banner
        </button>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Banner</th>
              <th class="px-5 py-3 font-bold">Badge</th>
              <th class="px-5 py-3 font-bold">Sede</th>
              <th class="px-5 py-3 text-right font-bold">Publicado</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="promo in promos"
              :key="promo.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <img
                    :src="promo.imageUrl"
                    :alt="promo.title"
                    class="h-9 w-14 rounded-lg border border-stroke object-cover"
                  />
                  <div class="min-w-0">
                    <p class="truncate text-xs font-bold text-text-primary">
                      {{ promo.title }}
                    </p>
                    <p class="truncate text-[10px] text-text-dim">
                      {{ promo.subtitle }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-black text-accent"
                >
                  {{ promo.badge }}
                </span>
              </td>
              <td class="px-5 py-3 text-[11px] text-text-muted">
                {{ branchName(promo.branchId) }}
              </td>
              <td
                class="px-5 py-3 text-right font-mono text-[10px] text-text-dim"
              >
                {{ formatDate(promo.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!pending && promos.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          Sin banners publicados
        </p>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Notificaciones enviadas
        </h2>
        <button
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
          @click="pushModalOpen = true"
        >
          <Plus class="h-3.5 w-3.5" />
          Nueva notificación
        </button>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Notificación</th>
              <th class="px-5 py-3 font-bold">Audiencia</th>
              <th class="px-5 py-3 font-bold">Envíos</th>
              <th class="px-5 py-3 text-right font-bold">Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in pushes"
              :key="log.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3">
                <p class="text-xs font-bold text-text-primary">
                  {{ log.title }}
                </p>
                <p class="mt-0.5 line-clamp-1 text-[10px] text-text-dim">
                  {{ log.body }}
                </p>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full border border-stroke bg-base px-2.5 py-0.5 text-[10px] font-black text-text-muted"
                >
                  {{
                    log.audience === 'ALL'
                      ? 'Todos'
                      : log.audience === 'EXPIRED'
                        ? 'Vencidas'
                        : branchName(log.branchId)
                  }}
                </span>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-black text-accent"
                >
                  {{ log.sent.toLocaleString('es-BO') }}
                </span>
              </td>
              <td
                class="px-5 py-3 text-right font-mono text-[10px] text-text-dim"
              >
                {{ formatDate(log.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!pending && pushes.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          Sin notificaciones enviadas
        </p>
      </div>
      <p
        v-if="pushResult"
        class="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-[11px] font-bold text-emerald-400"
      >
        {{ pushResult }}
      </p>
    </section>

    <UModal
      v-model:open="bannerModalOpen"
      title="Banner promocional"
      description="Se publica en el feed de promociones de la app móvil."
    >
      <template #body>
        <form class="space-y-3" @submit.prevent="submitBanner()">
          <input
            v-model="bannerTitle"
            type="text"
            placeholder="Título del banner"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <input
            v-model="bannerSubtitle"
            type="text"
            placeholder="Subtítulo"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <div class="grid grid-cols-2 gap-3">
            <input
              v-model="bannerBadge"
              type="text"
              placeholder="Badge (ej. -25%)"
              class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
            <USelectMenu
              v-model="bannerBranch"
              :items="branchItems"
              value-key="value"
            />
          </div>
          <input
            v-model="bannerImage"
            type="url"
            placeholder="URL de imagen (opcional)"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Vista previa
            </p>
            <div
              class="overflow-hidden rounded-2xl border border-stroke bg-base"
            >
              <div class="relative h-24">
                <img
                  v-if="bannerImage"
                  :src="bannerImage"
                  :alt="bannerTitle"
                  class="h-full w-full object-cover"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center bg-surface"
                >
                  <ImageUp class="h-5 w-5 text-text-dim" />
                </div>
                <span
                  class="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-black text-white"
                >
                  {{ bannerBadge || 'NUEVO' }}
                </span>
              </div>
              <div class="p-3">
                <p class="text-xs font-black text-text-primary">
                  {{ bannerTitle || 'Título del banner' }}
                </p>
                <p class="mt-0.5 text-[10px] text-text-dim">
                  {{ bannerSubtitle || 'Subtítulo del banner' }}
                </p>
              </div>
            </div>
          </div>
          <p v-if="bannerError" class="text-[11px] font-bold text-red-400">
            {{ bannerError }}
          </p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="bannerModalOpen = false"
          />
          <UButton
            label="Publicar banner"
            icon="i-lucide-image-up"
            @click="submitBanner"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="couponModalOpen"
      title="Cupón para la app"
      description="Se publica en Promociones según el nivel de membresía del socio."
    >
      <template #body>
        <form class="space-y-3" @submit.prevent="submitCoupon()">
          <input
            v-model="couponTitle"
            type="text"
            placeholder="Título del cupón"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <input
            v-model="couponDescription"
            type="text"
            placeholder="Descripción del beneficio"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <div class="grid grid-cols-2 gap-3">
            <input
              v-model="couponBadge"
              type="text"
              placeholder="Badge (ej. -25%)"
              class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
            <input
              v-model="couponCode"
              type="text"
              placeholder="Código (ej. CF-PRO25)"
              class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 font-mono text-sm uppercase text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
          </div>
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Niveles con acceso
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="level in LEVEL_OPTIONS"
                :key="level"
                type="button"
                class="cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition"
                :class="
                  couponLevels.includes(level)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-stroke bg-base text-text-dim hover:text-text-muted'
                "
                @click="toggleLevel(level)"
              >
                {{ level }}
              </button>
            </div>
          </div>
          <USelectMenu
            v-model="couponBranch"
            :items="branchItems"
            value-key="value"
          />
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Vista previa
            </p>
            <div
              class="rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-xs font-black text-text-primary">
                  {{ couponTitle || 'Título del cupón' }}
                </p>
                <span
                  class="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-black text-accent"
                >
                  {{ couponBadge || 'NUEVO' }}
                </span>
              </div>
              <p class="mt-0.5 text-[10px] text-text-dim">
                {{ couponDescription || 'Descripción del beneficio' }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  class="rounded-lg border border-stroke bg-surface px-2 py-0.5 font-mono text-[10px] font-black text-accent"
                >
                  {{ couponCode || 'CÓDIGO' }}
                </span>
                <span
                  v-for="level in couponLevels"
                  :key="level"
                  class="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-text-muted"
                >
                  {{ level }}
                </span>
              </div>
            </div>
          </div>
          <p v-if="couponError" class="text-[11px] font-bold text-red-400">
            {{ couponError }}
          </p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="couponModalOpen = false"
          />
          <UButton
            label="Crear cupón"
            icon="i-lucide-ticket-percent"
            @click="submitCoupon"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="pushModalOpen"
      title="Notificación push"
      description="Envío masivo o segmentado vía Firebase Cloud Messaging."
    >
      <template #body>
        <form class="space-y-3" @submit.prevent="submitPush()">
          <input
            v-model="pushTitle"
            type="text"
            placeholder="Título de la notificación"
            class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <textarea
            v-model="pushBody"
            rows="3"
            placeholder="Mensaje para los socios…"
            class="w-full resize-none rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
          />
          <div class="grid grid-cols-2 gap-3">
            <USelectMenu
              v-model="pushAudience"
              :items="audienceItems"
              value-key="value"
            />
            <USelectMenu
              v-if="pushAudience === 'BRANCH'"
              v-model="pushBranch"
              :items="branchOnlyItems"
              value-key="value"
              placeholder="Selecciona sede…"
            />
          </div>
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Vista previa
            </p>
            <div class="rounded-2xl border border-stroke bg-base p-3">
              <div class="flex items-start gap-2.5">
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent"
                >
                  <Dumbbell class="h-4 w-4 text-white" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between">
                    <p
                      class="text-[9px] font-bold uppercase tracking-widest text-text-dim"
                    >
                      Capital Fitness
                    </p>
                    <p class="text-[9px] text-text-dim">ahora</p>
                  </div>
                  <p class="mt-0.5 text-xs font-bold text-text-primary">
                    {{ pushTitle || 'Título de la notificación' }}
                  </p>
                  <p class="text-[11px] text-text-muted">
                    {{ pushBody || 'Mensaje para los socios…' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p v-if="pushError" class="text-[11px] font-bold text-red-400">
            {{ pushError }}
          </p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="pushModalOpen = false"
          />
          <UButton
            label="Enviar notificación"
            icon="i-lucide-send"
            @click="submitPush"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="confirmOpen = false"
          />
          <UButton
            label="Confirmar"
            :loading="confirming"
            @click="runConfirm"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
