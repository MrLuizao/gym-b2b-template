<script setup lang="ts">
import { AlertTriangle, CheckCircle2, XCircle } from '@lucide/vue';

import type { CheckInResult } from '#shared/types';

const props = defineProps<{
  result: CheckInResult | null;
  visible: boolean;
}>();

const title = computed(() => {
  if (!props.result) return '';
  if (!props.result.granted) return 'ACCESO DENEGADO';
  return props.result.alert === 'YELLOW'
    ? 'MEMBRESÍA POR VENCER'
    : 'ACCESO CONCEDIDO';
});

const reasonText = computed(() => {
  if (!props.result) return '';
  if (props.result.message) return props.result.message;
  if (props.result.granted) return 'RIR-HUB';
  const labels: Record<string, string> = {
    MEMBER_NOT_FOUND: 'Socio no registrado',
    MEMBERSHIP_EXPIRED: 'Membresía Vencida - Favor de pasar a caja',
    BRANCH_FULL: 'Aforo completo en esta sede',
    QR_INVALID: 'Código QR inválido o expirado',
  };
  return labels[props.result.reason ?? ''] ?? 'No se pudo validar el acceso';
});

const titleClass = computed(() => {
  if (!props.result?.granted) return 'text-red-400';
  return props.result.alert === 'YELLOW' ? 'text-amber-400' : 'text-emerald-400';
});

const circleClass = computed(() => {
  if (!props.result) return '';
  if (!props.result.granted) return 'bg-red-400/15 pulse-denied';
  if (props.result.alert === 'YELLOW') return 'bg-amber-400/15 pulse-yellow';
  return 'bg-emerald-400/15 pulse-granted';
});
</script>

<template>
  <Transition name="access-fade">
    <div
      v-if="visible && result"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div class="animate-access-pop flex flex-col items-center gap-5 text-center">
        <div
          class="flex h-28 w-28 items-center justify-center rounded-full"
          :class="circleClass"
        >
          <AlertTriangle
            v-if="result.granted && result.alert === 'YELLOW'"
            class="h-16 w-16 text-amber-400"
          />
          <CheckCircle2
            v-else-if="result.granted"
            class="h-16 w-16 text-emerald-400"
          />
          <XCircle v-else class="h-20 w-20 text-red-400" />
        </div>
        <div>
          <p
            class="text-3xl font-black tracking-tight"
            :class="titleClass"
          >
            {{ title }}
          </p>
          <p v-if="result.member" class="mt-2 text-lg font-bold text-text-primary">
            {{ result.member.name }}
          </p>
          <p class="mt-1 text-sm font-semibold text-text-muted">{{ reasonText }}</p>
        </div>
      </div>
    </div>
  </Transition>
</template>
