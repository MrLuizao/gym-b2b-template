<script setup lang="ts">
import type { Component } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    trend: number;
    spark: number[];
    icon?: Component;
  }>(),
  { icon: undefined },
);

const trendClasses = computed(() =>
  props.trend >= 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400',
);
</script>

<template>
  <div class="rounded-2xl border border-stroke bg-surface p-5 transition hover:border-accent/40">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-widest text-text-dim">
          {{ props.label }}
        </p>
        <p class="mt-2 text-2xl font-black tracking-tight text-text-primary">
          {{ props.value }}
        </p>
      </div>
      <div
        v-if="props.icon"
        class="rounded-xl border border-stroke bg-white/5 p-2 text-text-muted"
      >
        <component :is="props.icon" class="h-4 w-4" />
      </div>
    </div>
    <div class="mt-3 flex items-end justify-between gap-3">
      <span
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
        :class="trendClasses"
      >
        {{ props.trend >= 0 ? '+' : '' }}{{ props.trend.toFixed(1) }}%
      </span>
      <Sparkline :values="props.spark" :positive="props.trend >= 0" :width="110" :height="36" />
    </div>
  </div>
</template>
