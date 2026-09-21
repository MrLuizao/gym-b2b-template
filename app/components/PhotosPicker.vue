<script setup lang="ts">
import { ImagePlus, X } from '@lucide/vue';

const model = defineModel<string[]>({ default: () => [] });

const props = withDefaults(defineProps<{ max?: number }>(), { max: 8 });

const emit = defineEmits<{
  error: [message: string];
}>();

function pick(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  for (const file of files) {
    if (model.value.length >= props.max) break;
    if (file.size > 2.5 * 1024 * 1024) {
      emit('error', 'Cada imagen no debe superar 2.5 MB');
      continue;
    }
    const reader = new FileReader();
    reader.onload = () => {
      model.value = [...model.value, String(reader.result ?? '')];
    };
    reader.readAsDataURL(file);
  }
}

function removeAt(index: number): void {
  model.value = model.value.filter((_, i) => i !== index);
}
</script>

<template>
  <div class="grid grid-cols-4 gap-2">
    <div
      v-for="(photo, index) in model"
      :key="index"
      class="group relative overflow-hidden rounded-lg border border-stroke"
    >
      <img
        :src="photo"
        :alt="`Foto ${index + 1}`"
        class="h-14 w-full object-cover"
      />
      <button
        type="button"
        class="absolute right-1 top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
        @click.prevent="removeAt(index)"
      >
        <X class="h-2.5 w-2.5" />
      </button>
    </div>
    <label
      v-if="model.length < max"
      class="flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stroke bg-base text-text-dim transition hover:border-accent hover:text-accent"
    >
      <input
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="pick"
      />
      <ImagePlus class="h-4 w-4" />
      <span class="text-[8px] font-bold uppercase tracking-widest">Agregar</span>
    </label>
  </div>
</template>
