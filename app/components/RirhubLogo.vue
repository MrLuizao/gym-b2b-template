<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showTagline?: boolean;
    tagline?: string;
    showIcon?: boolean;
    iconOnly?: boolean;
  }>(),
  {
    size: 'md',
    showTagline: true,
    tagline: 'B2B & DMS',
    showIcon: true,
    iconOnly: false,
  },
);

const iconSizes = {
  sm: 'h-8 w-8 rounded-lg p-1.5',
  md: 'h-10 w-10 rounded-xl p-2',
  lg: 'h-12 w-12 rounded-2xl p-2.5',
  xl: 'h-14 w-14 rounded-2xl p-3',
};

const textSizes = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

const tagSizes = {
  sm: 'text-[8px] tracking-[0.2em]',
  md: 'text-[9px] tracking-[0.25em]',
  lg: 'text-[10px] tracking-[0.25em]',
  xl: 'text-[11px] tracking-[0.3em]',
};
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Wordmark -->
    <div v-if="!iconOnly" class="min-w-0">
      <div class="flex items-baseline leading-none">
        <span
          class="font-black tracking-tight text-white uppercase"
          :class="textSizes[size]"
        >
          RIR<span class="logo-gradient-text font-black">HUB</span>
        </span>
      </div>
      <p
        v-if="showTagline"
        class="mt-1 font-bold uppercase text-text-dim leading-none"
        :class="tagSizes[size]"
      >
        {{ tagline }}
      </p>
    </div>
  </div>
</template>
