<script setup lang="ts">
import { ImageUp, Loader2 } from '@lucide/vue';

const model = defineModel<string>({ default: '' });

withDefaults(
  defineProps<{
    label?: string;
    compact?: boolean;
  }>(),
  { label: 'Subir imagen', compact: false },
);

const emit = defineEmits<{
  error: [message: string];
}>();

const processing = ref(false);

/// La imagen se guarda como base64 en el doc (límite 1 MiB por doc) —
/// se comprime automáticamente antes de asignarla.
async function pick(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    emit('error', 'El archivo debe ser una imagen (JPG o PNG)');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    emit('error', 'La imagen no debe superar 5 MB — usa un JPG o PNG más ligero');
    return;
  }
  processing.value = true;
  try {
    const dataUrl = await compressImageFile(file, { maxDim: 1280, targetChars: 320_000 });
    if (dataUrl.length > 400_000) {
      emit('error', 'La imagen quedó muy pesada — usa un JPG más simple o de menor resolución');
      return;
    }
    model.value = dataUrl;
  } catch {
    emit('error', 'No se pudo procesar la imagen — intenta con un JPG o PNG');
  } finally {
    processing.value = false;
  }
}
</script>

<template>
  <div>
    <label
      class="flex items-center gap-3 rounded-xl border border-dashed border-stroke bg-base transition"
      :class="[compact ? 'px-3 py-2.5' : 'px-4 py-3', processing ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-accent']"
    >
      <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="processing" @change="pick" />
      <img
        v-if="model && !processing"
        :src="model"
        alt="Imagen seleccionada"
        class="h-10 w-16 rounded-lg border border-stroke object-cover"
      />
      <Loader2 v-else-if="processing" class="h-4 w-4 shrink-0 animate-spin text-accent" />
      <ImageUp v-else class="h-4 w-4 shrink-0 text-text-dim" />
      <span class="truncate text-xs text-text-dim">
        {{ processing ? 'Procesando…' : model ? 'Cambiar imagen' : label }}
      </span>
    </label>
    <p class="mt-1.5 text-[10px] leading-snug text-text-dim">
      JPG o PNG · máx 5 MB — se comprime automáticamente
    </p>
  </div>
</template>
