<script setup lang="ts">
import { ImageUp } from '@lucide/vue';

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

function pick(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 2.5 * 1024 * 1024) {
    emit('error', 'La imagen no debe superar 2.5 MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    model.value = String(reader.result ?? '');
  };
  reader.readAsDataURL(file);
  (event.target as HTMLInputElement).value = '';
}
</script>

<template>
  <label
    class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stroke bg-base transition hover:border-accent"
    :class="compact ? 'px-3 py-2.5' : 'px-4 py-3'"
  >
    <input type="file" accept="image/*" class="hidden" @change="pick" />
    <img
      v-if="model"
      :src="model"
      alt="Imagen seleccionada"
      class="h-10 w-16 rounded-lg border border-stroke object-cover"
    />
    <ImageUp v-else class="h-4 w-4 shrink-0 text-text-dim" />
    <span class="truncate text-xs text-text-dim">
      {{ model ? 'Cambiar imagen' : label }}
    </span>
  </label>
</template>
