<script setup lang="ts">
import { ShieldAlert, ShieldCheck, ShieldX } from '@lucide/vue';

import type { CheckInResult, Member } from '#shared/types';

const props = defineProps<{
  member: Member | null;
  result: CheckInResult | null;
}>();

const active = computed(() => props.member?.membershipStatus === 'ACTIVE');
const expiring = computed(
  () => props.result?.granted === true && props.result.alert === 'YELLOW',
);

const statusLabel = computed(() => {
  if (expiring.value) return 'POR VENCER';
  return active.value ? 'ACTIVA' : 'VENCIDA';
});

const statusClasses = computed(() => {
  if (expiring.value) {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-400';
  }
  return active.value
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
    : 'border-red-400/30 bg-red-400/10 text-red-400';
});

const resultClasses = computed(() => {
  if (!props.result) return '';
  if (!props.result.granted) {
    return 'border-red-400/30 bg-red-400/10 text-red-400';
  }
  if (props.result.alert === 'YELLOW') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-400';
  }
  return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400';
});

const resultText = computed(() => {
  if (!props.result) return '';
  if (props.result.message) return props.result.message;
  return props.result.granted
    ? 'Acceso registrado correctamente'
    : `Acceso denegado · ${props.result.reason ?? 'ERROR'}`;
});
</script>

<template>
  <div class="rounded-2xl border border-stroke bg-surface p-5">
    <p class="text-[11px] font-bold uppercase tracking-widest text-text-dim">
      Socio detectado
    </p>

    <template v-if="member">
      <div class="mt-4 flex items-center gap-4">
        <img
          :src="member.photoUrl"
          :alt="member.name"
          class="h-16 w-16 rounded-2xl border border-stroke object-cover"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-black tracking-tight text-text-primary">
            {{ member.name }}
          </p>
          <p class="mt-0.5 font-mono text-[11px] text-text-dim">
            UID {{ member.id }} · Nº {{ member.memberNumber }}
          </p>
          <p class="mt-1 text-xs font-bold text-text-muted">{{ member.membershipType }}</p>
        </div>
        <span
          class="rounded-full border px-3 py-1 text-xs font-bold"
          :class="statusClasses"
        >
          {{ expiring ? 'POR VENCER' : active ? 'ACTIVA' : 'VENCIDA' }}
        </span>
      </div>

      <div
        v-if="result"
        class="mt-4 rounded-xl border px-4 py-3 text-xs font-bold"
        :class="resultClasses"
      >
        {{ result.granted ? (result.message || 'Acceso registrado correctamente') : `Acceso denegado · ${result.reason ?? 'ERROR'}` }}
      </div>
    </template>

    <div
      v-else
      class="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-stroke py-10 text-center"
    >
      <ScanLine class="h-7 w-7 text-text-dim" />
      <p class="text-xs font-semibold text-text-dim">
        Escanea un código QR para ver el perfil del socio
      </p>
    </div>
  </div>
</template>
