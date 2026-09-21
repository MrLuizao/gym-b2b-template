<script setup lang="ts">
import { Camera, CameraOff, Keyboard, ScanLine } from '@lucide/vue';
import type { Html5Qrcode } from 'html5-qrcode';

const emit = defineEmits<{ detect: [code: string] }>();

const cameraActive = ref(false);
const starting = ref(false);
const cameraError = ref<string | null>(null);
const usbCode = ref('');
const usbInputRef = ref<HTMLInputElement | null>(null);

let scanner: Html5Qrcode | null = null;

async function startCamera(): Promise<void> {
  if (cameraActive.value || !import.meta.client) return;
  starting.value = true;
  cameraError.value = null;
  try {
    const { Html5Qrcode } = await import('html5-qrcode');
    scanner = new Html5Qrcode('qr-camera');
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decoded: string) => emit('detect', decoded),
      () => undefined,
    );
    cameraActive.value = true;
  } catch (cause) {
    cameraError.value =
      cause instanceof Error ? cause.message : 'No se pudo acceder a la cámara';
    scanner = null;
  } finally {
    starting.value = false;
  }
}

async function stopCamera(): Promise<void> {
  if (!scanner) return;
  try {
    await scanner.stop();
    scanner.clear();
  } catch {
    // La cámara ya estaba detenida.
  }
  scanner = null;
  cameraActive.value = false;
}

function submitUsb(): void {
  const code = usbCode.value.trim();
  if (!code) return;
  emit('detect', code);
  usbCode.value = '';
  usbInputRef.value?.focus();
}

onBeforeUnmount(() => {
  void scanner?.stop().catch(() => undefined);
});

onMounted(() => {
  usbInputRef.value?.focus();
});
</script>

<template>
  <div class="rounded-2xl border border-stroke bg-surface p-5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ScanLine class="h-4 w-4 text-accent" />
        <h2 class="text-sm font-black tracking-tight text-text-primary">
          Escáner en vivo
        </h2>
      </div>
      <span
        class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
        :class="
          cameraActive
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
            : 'border-stroke bg-white/5 text-text-dim'
        "
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="cameraActive ? 'animate-pulse bg-emerald-400' : 'bg-text-dim'"
        />
        {{ cameraActive ? 'En vivo' : 'Inactivo' }}
      </span>
    </div>

    <div
      id="qr-camera"
      class="mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-stroke bg-base"
    >
      <div
        v-if="!cameraActive"
        class="flex flex-col items-center gap-2 text-text-dim"
      >
        <Camera class="h-8 w-8" />
        <p class="text-xs font-semibold">Cámara web inactiva</p>
      </div>
    </div>

    <p v-if="cameraError" class="mt-2 text-[11px] font-semibold text-red-400">
      {{ cameraError }}
    </p>

    <div class="mt-4 flex gap-2">
      <button
        v-if="!cameraActive"
        class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-black text-base transition hover:brightness-110 disabled:opacity-50"
        :disabled="starting"
        @click="startCamera()"
      >
        <ScanLine class="h-3.5 w-3.5" />
        {{ starting ? 'Iniciando…' : 'Activar cámara' }}
      </button>
      <button
        v-else
        class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stroke bg-white/5 px-4 py-2.5 text-xs font-black text-text-muted transition hover:text-text-primary"
        @click="stopCamera()"
      >
        <CameraOff class="h-3.5 w-3.5" />
        Detener cámara
      </button>
    </div>

    <div class="my-5 flex items-center gap-3">
      <div class="h-px flex-1 bg-stroke" />
      <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
        Lector USB
      </span>
      <div class="h-px flex-1 bg-stroke" />
    </div>

    <form class="space-y-2" @submit.prevent="submitUsb()">
      <label class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-text-dim">
        <Keyboard class="h-3.5 w-3.5" />
        Entrada de alta velocidad
      </label>
      <input
        ref="usbInputRef"
        v-model="usbCode"
        type="text"
        autocomplete="off"
        placeholder="Escanea la credencial del socio…"
        class="w-full rounded-xl border border-stroke bg-base px-4 py-2.5 font-mono text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
        @keydown.enter.prevent="submitUsb()"
      />
      <p class="text-[10px] leading-relaxed text-text-dim">
        El lector USB actúa como teclado: enfoca este campo, escanea el QR y presiona
        Enter para registrar el acceso.
      </p>
    </form>
  </div>
</template>
