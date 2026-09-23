<script setup lang="ts">
import {
  BellRing,
  FileEdit,
  ImageUp,
  Plus,
  Send,
  TicketPercent,
} from '@lucide/vue';

import type { Branch, MembershipPlan, PushLog } from '#shared/types';

const {
  promos,
  coupons,
  pushes,
  pending,
  load,
  createPromo,
  sendPush,
} = useCms();
const { session } = useAuth();
/// Cupones y push son contenido comercial global — solo el admin los crea.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const branches = ref<Branch[]>([]);
const plans = ref<MembershipPlan[]>([]);

const bannerModalOpen = ref(false);

const bannerTitle = ref('');
const bannerSubtitle = ref('');
const bannerBadge = ref('NUEVO');
const bannerImage = ref('');
const bannerBranch = ref('todas');

const bannerError = ref<string | null>(null);

const branchItems = computed(() => [
  { label: 'Todas las sedes', value: 'todas' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

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

const sentCount = computed(
  () => pushes.value.filter((log) => log.status === 'SENT').length,
);
const draftCount = computed(
  () => pushes.value.filter((log) => log.status === 'DRAFT').length,
);

function pushAudienceLabel(log: PushLog): string {
  if (log.audience === 'ALL') return 'todos los socios';
  if (log.audience === 'EXPIRED')
    return 'socios con membresía vencida';
  return `los socios de ${branchName(log.branchId)}`;
}

/// Lanza el envío (o reenvío) de una notificación — pide confirmación antes.
function askSendPush(log: PushLog): void {
  askConfirm(
    log.status === 'SENT' ? 'Reenviar notificación' : 'Enviar notificación',
    `Se ${log.status === 'SENT' ? 'reenviará' : 'enviará'} "${log.title}" a ${pushAudienceLabel(log)}. Esta acción no se puede deshacer.`,
    async () => {
      await sendPush(log);
    },
  );
}

function branchName(id: string | null): string {
  if (!id) return 'Todas las sedes';
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

function planLabel(planId: string): string {
  if (planId === 'ALL') return 'Todos';
  return plans.value.find((p) => p.id === planId)?.name ?? planId;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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

onMounted(async () => {
  await load();
  try {
    const [branchList, planList] = await Promise.all([
      $api<Branch[]>('/api/branches'),
      $api<MembershipPlan[]>('/api/plans'),
    ]);
    branches.value = branchList;
    plans.value = planList;
  } catch {
    branches.value = [];
    plans.value = [];
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          <BellRing class="h-4 w-4 text-emerald-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Push enviadas
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ sentCount }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <FileEdit class="h-4 w-4 text-amber-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Borradores
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ draftCount }}
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
          {{ totalReach.toLocaleString('es-MX') }}
        </p>
      </div>
    </div>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Cupones
        </h2>
        <button
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
          @click="navigateTo('/cms/cupones/nuevo')"
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
              <th class="px-5 py-3 font-bold">Planes</th>
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
                    <button
                      class="block max-w-full cursor-pointer truncate text-xs font-bold text-text-primary transition hover:text-accent hover:underline"
                      @click="navigateTo(`/cms/cupones/${coupon.id}`)"
                    >
                      {{ coupon.title }}
                    </button>
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
                    v-for="planId in coupon.planIds"
                    :key="planId"
                    class="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-text-muted"
                  >
                    {{ planLabel(planId) }}
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

    <!-- Sección de banners oculta — el feed de promociones ya no se muestra en la app.
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Banners
        </h2>
        <button
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
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
    -->

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Notificaciones enviadas
        </h2>
        <button
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
          @click="navigateTo('/cms/notificaciones/nueva')"
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
              <th class="px-5 py-3 font-bold">Estado</th>
              <th class="px-5 py-3 font-bold">Envíos</th>
              <th class="px-5 py-3 text-right font-bold">Fecha</th>
              <th v-if="isAdmin" class="px-5 py-3 text-right font-bold" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in pushes"
              :key="log.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-1.5">
                  <button
                    class="cursor-pointer text-xs font-bold text-text-primary transition hover:text-accent hover:underline"
                    @click="navigateTo(`/cms/notificaciones/${log.id}`)"
                  >
                    {{ log.title }}
                  </button>
                  <span
                    v-if="log.kind === 'SPONSOR'"
                    class="rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-accent"
                  >
                    Aliado
                  </span>
                </div>
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
                <span class="flex items-center gap-1.5">
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="
                      log.status === 'SENT'
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                    "
                  />
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest"
                    :class="
                      log.status === 'SENT'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    "
                  >
                    {{ log.status === 'SENT' ? 'Enviada' : 'Borrador' }}
                  </span>
                </span>
                <p
                  v-if="log.status === 'DRAFT' && log.scheduledAt"
                  class="mt-0.5 font-mono text-[9px] text-text-dim"
                >
                  prog. {{ formatDate(log.scheduledAt) }}
                </p>
              </td>
              <td class="px-5 py-3">
                <span
                  v-if="log.status === 'SENT'"
                  class="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-black text-accent"
                >
                  {{ log.sent.toLocaleString('es-MX') }}
                </span>
                <span v-else class="text-[11px] text-text-dim">—</span>
              </td>
              <td
                class="px-5 py-3 text-right font-mono text-[10px] text-text-dim"
              >
                {{ formatDate(log.createdAt) }}
              </td>
              <td v-if="isAdmin" class="px-5 py-3 text-right">
                <button
                  type="button"
                  class="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black transition"
                  :class="
                    log.status === 'DRAFT'
                      ? 'bg-accent text-base hover:opacity-90'
                      : 'border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                  "
                  @click="askSendPush(log)"
                >
                  <Send class="h-3 w-3" />
                  {{ log.status === 'SENT' ? 'Reenviar' : 'Enviar' }}
                </button>
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
          <ImagePicker
            v-model="bannerImage"
            label="Subir imagen del banner (opcional)"
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
                  class="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-black text-base"
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
