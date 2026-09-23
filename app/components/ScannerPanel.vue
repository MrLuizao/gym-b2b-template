<script setup lang="ts">
import { Keyboard, ScanLine } from '@lucide/vue';

const emit = defineEmits<{ detect: [code: string] }>();

const usbCode = ref('');
const usbInputRef = ref<HTMLInputElement | null>(null);

function submitUsb(): void {
  const code = usbCode.value.trim();
  if (!code) return;
  emit('detect', code);
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
        Lector QR
      </h2>
    </div>

    <form class="mt-4 space-y-2" @submit.prevent="submitUsb()">
      <label
        class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-text-dim"
      >
        <Keyboard class="h-3.5 w-3.5" />
        Entrada del lector
      </label>
      <input
        ref="usbInputRef"
        v-model="usbCode"
        type="text"
        autocomplete="off"
        placeholder="Escanea la credencial del socio…"
        class="w-full rounded-xl border border-stroke bg-base px-4 py-3 font-mono text-base text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
        @keydown.enter.prevent="submitUsb()"
      />
      <p class="text-[10px] leading-relaxed text-text-dim">
        El lector actúa como teclado: este campo queda enfocado, escanea el QR o
        escribe el número de socio y presiona Enter para registrar el acceso.
      </p>
    </form>
  </div>
</template>
