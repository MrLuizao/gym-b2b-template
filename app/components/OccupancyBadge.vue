<script setup lang="ts">
const props = defineProps<{
  ratio: number;
  label?: string;
}>();

const classes = computed(() => {
  if (props.ratio < 0.5) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
  if (props.ratio <= 0.8) return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
  return 'text-red-400 border-red-400/30 bg-red-400/10';
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
    :class="classes"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current" />
    {{ Math.round(props.ratio * 100) }}%
    <span v-if="label" class="font-medium opacity-70">{{ label }}</span>
  </span>
</template>
