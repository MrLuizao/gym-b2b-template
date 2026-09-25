<script setup lang="ts">
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  ScanLine,
  TriangleAlert,
  XCircle,
} from '@lucide/vue';

import type { CheckInResult } from '#shared/types';

const props = defineProps<{
  result: CheckInResult | null;
  pending: boolean;
}>();

const DENIED_LABELS: Record<string, string> = {
  MEMBER_NOT_FOUND: 'Socio no registrado',
  MEMBERSHIP_EXPIRED: 'Membresía vencida — pasar a caja',
  PLAN_BRANCH_RESTRICTED: 'Su plan no cubre esta sede',
  ALREADY_CHECKED_IN: 'Ya registró entrada',
  BRANCH_FULL: 'Aforo completo en esta sede',
  QR_INVALID: 'Código QR inválido o expirado',
};

const tone = computed<'idle' | 'granted' | 'yellow' | 'denied'>(() => {
  if (!props.result) return 'idle';
  if (!props.result.granted) return 'denied';
  return props.result.alert === 'YELLOW' ? 'yellow' : 'granted';
});

const statusLabel = computed(() => {
  switch (tone.value) {
    case 'granted':
      return 'Acceso concedido';
    case 'yellow':
      return 'Membresía por vencer';
    case 'denied':
      return 'Acceso denegado';
    default:
      return 'Sin escaneos';
  }
});

const statusColor = computed(() => {
  switch (tone.value) {
    case 'granted':
      return 'text-emerald-400';
    case 'yellow':
      return 'text-amber-400';
    case 'denied':
      return 'text-red-400';
    default:
      return 'text-text-dim';
  }
});

const messageBoxClass = computed(() => {
  switch (tone.value) {
    case 'granted':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400';
    case 'yellow':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-400';
    case 'denied':
      return 'border-red-400/30 bg-red-400/10 text-red-400';
    default:
      return '';
  }
});

const membershipMeta = computed(() => {
  const until = props.result?.member?.membershipUntil;
  if (!until) return null;
  const dayMs = 86_400_000;
  const days = Math.ceil((until - Date.now()) / dayMs);
  const date = new Date(until).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (days > 0) {
    return {
      date,
      label: `Vence el ${date} · en ${days} día${days === 1 ? '' : 's'}`,
      expired: false,
    };
  }
  const ago = Math.abs(days);
  return {
    date,
    label: `Venció el ${date} · hace ${ago} día${ago === 1 ? '' : 's'}`,
    expired: true,
  };
});

const subtitle = computed(() => {
  if (!props.result) return '';
  if (props.result.message) return props.result.message;
  if (props.result.granted) return 'Acceso registrado correctamente';
  return (
    DENIED_LABELS[props.result.reason ?? ''] ??
    'No se pudo validar el acceso'
  );
});
</script>

<template>
  <section
    class="flex flex-1 flex-col rounded-2xl border border-stroke bg-surface p-5"
  >
    <div class="flex items-center justify-between">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Resultado del acceso
      </h2>
    </div>

    <!-- Validando -->
    <div
      v-if="pending"
      class="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stroke py-14 text-text-dim"
    >
      <Loader2 class="h-7 w-7 animate-spin text-accent" />
      <p class="text-xs font-semibold">Validando credencial…</p>
    </div>

    <!-- Resultado -->
    <div v-else-if="result" class="mt-4 flex flex-1 flex-col justify-center">
      <div
        :key="`${result.granted}-${result.reason ?? ''}-${result.member?.id ?? ''}`"
        class="animate-access-pop"
      >
        <div
          class="rounded-xl border px-4 py-3 text-xs font-bold"
          :class="messageBoxClass"
        >
          {{ subtitle }}
        </div>

        <div class="mt-7 flex items-start gap-5">
        <MemberAvatar
          v-if="result.member"
          :avatar-id="result.member.avatar"
          :initials="
            result.member.name
              .split(' ')
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
          "
          :size="80"
        />

        <div class="min-w-0 flex-1">
          <template v-if="result.member">
            <button
              type="button"
              class="block max-w-full cursor-pointer truncate text-left text-2xl font-black tracking-tight text-text-primary transition hover:text-accent hover:underline"
              @click="navigateTo(`/socios/${result.member!.id}`)"
            >
              {{ result.member.name }}
            </button>
            <p class="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-text-dim">
              Nº {{ result.member.memberNumber }}
              <span class="flex items-center gap-1">
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="
                    result.member.membershipStatus === 'ACTIVE'
                      ? 'bg-emerald-400'
                      : 'bg-red-400'
                  "
                />
                <span
                  class="font-sans text-[10px] font-bold uppercase tracking-widest"
                  :class="
                    result.member.membershipStatus === 'ACTIVE'
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  "
                >
                  {{
                    result.member.membershipStatus === 'ACTIVE'
                      ? 'Activa'
                      : 'Vencida'
                  }}
                </span>
              </span>
            </p>
            <p class="mt-1.5 text-base font-black text-text-primary">
              {{ result.member.membershipType }}
            </p>
            <p
              v-if="membershipMeta"
              class="mt-0.5 text-xs font-bold"
              :class="membershipMeta.expired ? 'text-red-400' : 'text-text-muted'"
            >
              {{ membershipMeta.label }}
            </p>
          </template>
          <template v-else>
            <p class="text-2xl font-black tracking-tight" :class="statusColor">
              {{ statusLabel }}
            </p>
            <p class="mt-1 text-xs font-semibold text-text-dim">
              Sin datos de socio
            </p>
          </template>
        </div>

        <CheckCircle2
          v-if="tone === 'granted'"
          class="h-14 w-14 shrink-0 text-emerald-400"
        />
        <TriangleAlert
          v-else-if="tone === 'yellow'"
          class="h-14 w-14 shrink-0 text-amber-400"
        />
        <XCircle v-else class="h-14 w-14 shrink-0 text-red-400" />
        </div>
      </div>

      <button
        v-if="result.member"
        type="button"
        class="mt-10 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[11px] font-black uppercase tracking-widest text-base transition hover:opacity-90"
        @click="navigateTo(`/socios/${result.member!.id}`)"
      >
        <CreditCard class="h-3.5 w-3.5" />
        Registrar pago
      </button>
    </div>

    <!-- En espera -->
    <div
      v-else
      class="mt-4 flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stroke py-14 text-center"
    >
      <ScanLine class="h-7 w-7 text-text-dim" />
      <p class="text-xs font-semibold text-text-dim">
        Escanea el QR o la credencial del socio para validar su acceso
      </p>
    </div>
  </section>
</template>
