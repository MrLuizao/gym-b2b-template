<script setup lang="ts">
import { Building2, Keyboard, ScanLine } from '@lucide/vue';

import type { PartnerProvider } from '#shared/types';

const emit = defineEmits<{
  detect: [code: string];
  partner: [provider: PartnerProvider, token: string];
}>();

/// Modo de captura: credencial de socio o token de agregador
/// (Wellhub/TotalPass — el visitante genera el token en su app).
const mode = ref<'member' | PartnerProvider>('member');
const usbCode = ref('');
const usbInputRef = ref<HTMLInputElement | null>(null);

const modes = [
  { id: 'member' as const, label: 'Socio Capital', logo: null },
  {
    id: 'wellhub' as const,
    label: 'Wellhub',
    logo: '/partners/wellhub.svg',
  },
  {
    id: 'totalpass' as const,
    label: 'TotalPass',
    logo: '/partners/totalpass.svg',
  },
];

function submitUsb(): void {
  const code = usbCode.value.trim();
  if (!code) return;
  if (mode.value === 'member') emit('detect', code);
  else emit('partner', mode.value, code);
  usbCode.value = '';
  usbInputRef.value?.focus();
}

onMounted(() => {
  usbInputRef.value?.focus();
});
</script>

<template>
  <div class="flex flex-col rounded-2xl border border-stroke bg-surface p-5">
    <div class="flex items-center gap-2">
      <ScanLine class="h-4 w-4 text-accent" />
      <h2 class="text-sm font-black tracking-tight text-text-primary">
        Registro de acceso
      </h2>
    </div>

    <div class="mt-3 flex gap-1.5">
      <button
        v-for="m in modes"
        :key="m.id"
        type="button"
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition"
        :class="
          mode === m.id
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-stroke bg-base text-text-dim hover:text-text-muted'
        "
        @click="mode = m.id"
      >
        <img
          v-if="m.logo"
          :src="m.logo"
          :alt="m.label"
          class="-ml-1 h-4 w-4 rounded-sm"
        />
        {{ m.label }}
      </button>
    </div>

    <form class="mt-4 space-y-2" @submit.prevent="submitUsb()">
      <label
        class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-text-dim"
      >
        <Building2 v-if="mode !== 'member'" class="h-3.5 w-3.5" />
        <Keyboard v-else class="h-3.5 w-3.5" />
        {{ mode === 'member' ? 'Entrada del lector' : 'Token del agregador' }}
      </label>
      <input
        ref="usbInputRef"
        v-model="usbCode"
        type="text"
        autocomplete="off"
        :placeholder="
          mode === 'member'
            ? 'Escanea la credencial del socio…'
            : 'Escanea o teclea el token del día…'
        "
        class="w-full rounded-xl border border-stroke bg-base px-4 py-3 font-mono text-base text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
        @keydown.enter.prevent="submitUsb()"
      />
      <p class="text-[10px] leading-relaxed text-text-dim">
        {{
          mode === 'member'
            ? 'El lector actúa como teclado: este campo queda enfocado, escanea el QR o escribe el número de socio y presiona Enter para registrar el acceso.'
            : 'El visitante genera el token en su app de Wellhub/TotalPass — escanéalo o téclalo y presiona Enter. Se valida contra el agregador.'
        }}
      </p>
    </form>
  </div>
</template>
