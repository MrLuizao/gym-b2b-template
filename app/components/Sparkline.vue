<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    values: number[];
    width?: number;
    height?: number;
    positive?: boolean;
  }>(),
  { width: 120, height: 40, positive: true },
);

const color = computed(() => (props.positive ? '#10B981' : '#EF4444'));

const geometry = computed(() => {
  const values = props.values.length > 1 ? props.values : [0, ...props.values];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = props.width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => {
    const x = index * stepX;
    const y = props.height - ((value - min) / range) * (props.height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return {
    line: points.join(' '),
    area: `M0,${props.height} L${points.join(' L')} L${props.width},${props.height} Z`,
  };
});

const gradientId = useId();
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="overflow-visible"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="geometry.area" :fill="`url(#${gradientId})`" />
    <path
      :d="geometry.line"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
