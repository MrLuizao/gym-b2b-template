<script setup lang="ts">
import { ImagePlus, Loader2, X } from '@lucide/vue';

const model = defineModel<string[]>({ default: () => [] });

const props = withDefaults(
  defineProps<{ max?: number; label?: string }>(),
  { max: 8, label: 'Agregar foto' },
);

const emit = defineEmits<{
  error: [message: string];
}>();

const processing = ref(0);

/// Cada foto se guarda como base64 en el doc (límite 1 MiB por doc junto con
/// la imagen principal y el resto de campos) — se comprime automáticamente.
async function pick(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  for (const file of files) {
    if (model.value.length >= props.max) break;
    if (!file.type.startsWith('image/')) {
      emit('error', 'Solo imágenes JPG o PNG');
      continue;
    }
    if (file.size > 5 * 1024 * 1024) {
      emit('error', 'Cada imagen no debe superar 5 MB — usa JPG o PNG más ligeros');
      continue;
    }
    processing.value++;
    try {
      const dataUrl = await compressImageFile(file, { maxDim: 900, targetChars: 110_000 });
      if (dataUrl.length > 150_000) {
        emit('error', 'Una imagen quedó muy pesada — usa fotos más simples o de menor resolución');
        continue;
      }
      model.value = [...model.value, dataUrl];
    } catch {
      emit('error', 'No se pudo procesar una imagen — intenta con JPG o PNG');
    } finally {
      processing.value--;
    }
  }
}

function removeAt(index: number): void {
  model.value = model.value.filter((_, i) => i !== index);
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(photo, index) in model"
      :key="index"
      class="flex items-center gap-3 rounded-xl border border-stroke bg-base px-4 py-3"
    >
      <img
        :src="photo"
        :alt="`Foto ${index + 1}`"
        class="h-10 w-16 rounded-lg border border-stroke object-cover"
      />
      <span class="flex-1 text-xs text-text-dim">Foto {{ index + 1 }}</span>
      <button
        type="button"
        class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-dim transition hover:border-red-400/60 hover:text-red-400"
        @click.prevent="removeAt(index)"
      >
        <X class="h-3 w-3" />
      </button>
    </div>
    <label
      v-if="model.length < max"
      class="flex items-center gap-3 rounded-xl border border-dashed border-stroke bg-base px-4 py-3 transition"
      :class="processing ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-accent'"
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :multiple="max > 1"
        class="hidden"
        :disabled="processing > 0"
        @change="pick"
      />
      <Loader2 v-if="processing > 0" class="h-4 w-4 shrink-0 animate-spin text-accent" />
      <ImagePlus v-else class="h-4 w-4 shrink-0 text-text-dim" />
      <span class="truncate text-xs text-text-dim">
        {{ processing > 0 ? 'Procesando…' : label }}
      </span>
    </label>
    <p class="text-[10px] leading-snug text-text-dim">
      JPG o PNG · máx 5 MB — se comprime automáticamente
    </p>
  </div>
</template>
