<script setup lang="ts">
import { ArrowLeft, CreditCard } from '@lucide/vue';

import type { MemberDetail } from '#shared/types';

const route = useRoute();
const detail = ref<MemberDetail | null>(null);
const pending = ref(true);

onMounted(async () => {
  try {
    detail.value = await $fetch<MemberDetail>(
      `/api/members/${route.params.id}`,
    );
  } finally {
    pending.value = false;
  }
});

function statusMeta(status: string) {
  switch (status) {
    case 'EXPIRING':
      return {
        label: 'POR VENCER',
        cls: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
      };
    case 'EXPIRED':
      return {
        label: 'VENCIDA',
        cls: 'border-red-400/30 bg-red-400/10 text-red-400',
      };
    default:
      return {
        label: 'ACTIVA',
        cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
      };
  }
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div
    v-if="pending"
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cargando socio…
  </div>

  <div v-else-if="detail" class="space-y-6">
    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="mt-4 flex items-center gap-4">
        <img
          :src="detail.member.photoUrl"
          :alt="detail.member.name"
          class="h-16 w-16 rounded-2xl border border-stroke object-cover"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-black text-text-primary">
            {{ detail.member.name }}
          </p>
          <p class="font-mono text-[11px] text-text-dim">
            {{ detail.member.memberNumber }}
          </p>
        </div>
        <span
          class="rounded-full border px-3 py-1 text-[11px] font-bold"
          :class="statusMeta(detail.member.adminStatus).cls"
        >
          {{ statusMeta(detail.member.adminStatus).label }}
        </span>
      </div>
      <div class="mt-5 grid grid-cols-3 gap-4 border-t border-stroke pt-4">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Plan
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.member.membershipType }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Nivel
          </p>
          <p class="mt-1 text-sm font-black text-accent">
            {{ detail.member.membershipLevel }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Vence
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ formatDate(detail.member.membershipUntil) }}
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted">
        Historial de pagos
      </h2>
      <div class="space-y-3">
        <div
          v-for="payment in detail.payments"
          :key="payment.id"
          class="flex items-center gap-3 rounded-2xl border border-stroke bg-surface p-4"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl border border-stroke bg-base"
          >
            <CreditCard class="h-4 w-4 text-accent" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-bold text-text-primary">
              {{ payment.plan }}
            </p>
            <p class="font-mono text-[10px] text-text-dim">
              {{ payment.transactionId }}
            </p>
          </div>
          <span class="text-sm font-black text-text-primary">
            Bs {{ payment.amountBs }}
          </span>
          <span
            class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
            :class="
              payment.status === 'APPROVED'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                : 'border-red-400/30 bg-red-400/10 text-red-400'
            "
          >
            {{ payment.status === 'APPROVED' ? 'APROBADO' : 'RECHAZADO' }}
          </span>
        </div>
      </div>
      <p
        v-if="detail.payments.length === 0"
        class="py-6 text-center text-xs font-semibold text-text-dim"
      >
        Sin pagos registrados
      </p>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted">
        Últimos check-ins
      </h2>
      <div class="space-y-3">
        <div
          v-for="checkIn in detail.checkIns.slice(0, 8)"
          :key="checkIn.id"
          class="flex items-center gap-3 rounded-2xl border border-stroke bg-surface p-4"
        >
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :class="checkIn.granted ? 'bg-emerald-400' : 'bg-red-400'"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-bold text-text-primary">
              {{ checkIn.branchId.toUpperCase() }} ·
              {{ checkIn.method.toUpperCase() }}
            </p>
            <p class="text-[10px] text-text-dim">
              {{ formatDateTime(checkIn.checkInAt) }}
            </p>
          </div>
          <span
            class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
            :class="
              checkIn.granted
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                : 'border-red-400/30 bg-red-400/10 text-red-400'
            "
          >
            {{ checkIn.granted ? 'OK' : 'DENEGADO' }}
          </span>
        </div>
      </div>
      <p
        v-if="detail.checkIns.length === 0"
        class="py-6 text-center text-xs font-semibold text-text-dim"
      >
        Sin check-ins registrados
      </p>
    </section>

    <NuxtLink
      to="/socios"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Socios
    </NuxtLink>
  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Socio no encontrado
  </div>
</template>
