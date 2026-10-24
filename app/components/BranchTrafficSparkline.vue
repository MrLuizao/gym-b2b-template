<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    values?: number[];
    height?: number;
    color?: string;
  }>(),
  {
    values: () => [],
    height: 48,
    color: '#E11D48',
  },
);

const svgWidth = 240;

interface Point {
  x: number;
  y: number;
  val: number;
}

const geometry = computed(() => {
  const data =
    props.values && props.values.length === 24
      ? props.values
      : new Array<number>(24).fill(0);

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const paddingY = 4;
  const usableHeight = props.height - paddingY * 2;
  const stepX = svgWidth / Math.max(1, data.length - 1);

  const points: Point[] = data.map((val, idx) => {
    const x = idx * stepX;
    const y = props.height - paddingY - ((val - min) / range) * usableHeight;
    return { x, y, val };
  });

  if (points.length === 0) {
    return { linePath: '', areaPath: '', peakPoint: null, peakHour: 0 };
  }

  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const top = points[peakIdx];
    if (cur && top && cur.val > top.val) {
      peakIdx = i;
    }
  }
  const peakCandidate = points[peakIdx];
  const peakPoint =
    peakCandidate && data.some((v) => v > 0) ? peakCandidate : null;

  const first = points[0]!;
  let linePath = `M ${first.x.toFixed(1)},${first.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = (i === 0 ? points[0] : points[i - 1]) ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = (i + 2 < points.length ? points[i + 2] : points[i + 1]) ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    linePath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  const areaPath = `${linePath} L ${svgWidth},${props.height} L 0,${props.height} Z`;

  return { linePath, areaPath, peakPoint, peakHour: peakIdx };
});

const gradientId = useId();
</script>

<template>
  <div class="relative w-full select-none">
    <svg
      :viewBox="`0 0 ${svgWidth} ${height}`"
      preserveAspectRatio="none"
      class="w-full overflow-visible"
      :style="{ height: `${height}px` }"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.32" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path :d="geometry.areaPath" :fill="`url(#${gradientId})`" />
      <path
        :d="geometry.linePath"
        fill="none"
        :stroke="color"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <g v-if="geometry.peakPoint">
        <circle
          :cx="geometry.peakPoint.x"
          :cy="geometry.peakPoint.y"
          r="3"
          :fill="color"
        />
        <circle
          :cx="geometry.peakPoint.x"
          :cy="geometry.peakPoint.y"
          r="6"
          :fill="color"
          opacity="0.25"
        />
      </g>
    </svg>
  </div>
</template>
