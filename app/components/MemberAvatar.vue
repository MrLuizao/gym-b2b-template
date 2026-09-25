<script setup lang="ts">
import type { Component } from 'vue';

import {
  Dumbbell,
  Flame,
  Flower2,
  Heart,
  PersonStanding,
  Rocket,
  Shield,
  Star,
  Timer,
  Trophy,
  Waves,
  Zap,
} from '@lucide/vue';

import { memberAvatarSpec } from '#shared/member-avatars';

const ICONS: Record<string, Component> = {
  Zap,
  Flame,
  Dumbbell,
  PersonStanding,
  Heart,
  Trophy,
  Rocket,
  Shield,
  Star,
  Timer,
  Flower2,
  Waves,
};

const props = withDefaults(
  defineProps<{
    avatarId?: string | null;
    initials: string;
    size?: number;
  }>(),
  { avatarId: null, size: 36 },
);

const spec = computed(() => memberAvatarSpec(props.avatarId));
const iconComponent = computed(() =>
  spec.value ? ICONS[spec.value.icon] : null,
);
</script>

<template>
  <div
    v-if="spec"
    class="flex items-center justify-center overflow-hidden rounded-full"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      background: `linear-gradient(135deg, ${spec.from}, ${spec.to})`,
    }"
  >
    <component
      :is="iconComponent"
      :size="Math.round(size * 0.52)"
      :color="spec.dark ? '#1C1917' : '#FFFFFF'"
      :stroke-width="2.4"
    />
  </div>
  <div
    v-else
    class="flex items-center justify-center rounded-full border border-stroke bg-base font-black text-accent"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.33)}px`,
    }"
  >
    {{ initials }}
  </div>
</template>
