<script setup lang="ts">
import type { Chart } from 'chart.js';

import type { TrafficPoint } from '#shared/types';

const props = defineProps<{ traffic: TrafficPoint[] }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let chart: Chart<'line', number[], string> | null = null;

function labelsOf(points: TrafficPoint[]): string[] {
  return points.map((point) => `${String(point.hour).padStart(2, '0')}h`);
}

function valuesOf(points: TrafficPoint[]): number[] {
  return points.map((point) => point.value);
}

onMounted(async () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const { default: ChartCtor } = await import('chart.js/auto');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const areaFill = ctx.createLinearGradient(0, 0, 0, 240);
  areaFill.addColorStop(0, 'rgba(225, 29, 72, 0.32)');
  areaFill.addColorStop(1, 'rgba(225, 29, 72, 0)');

  chart = new ChartCtor(ctx, {
    type: 'line',
    data: {
      labels: labelsOf(props.traffic),
      datasets: [
        {
          label: 'Check-ins',
          data: valuesOf(props.traffic),
          borderColor: '#E11D48',
          backgroundColor: areaFill,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#E11D48',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#131823',
          borderColor: '#1E2638',
          borderWidth: 1,
          titleColor: '#F8FAFC',
          bodyColor: '#94A3B8',
          padding: 10,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(30, 38, 56, 0.55)' },
          ticks: { color: '#64748B', font: { size: 10 } },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(30, 38, 56, 0.55)' },
          ticks: { color: '#64748B', font: { size: 10 } },
          border: { display: false },
        },
      },
    },
  });
});

watch(
  () => props.traffic,
  (traffic) => {
    if (!chart) return;
    chart.data.labels = labelsOf(traffic);
    chart.data.datasets[0]!.data = valuesOf(traffic);
    chart.update();
  },
);

onBeforeUnmount(() => {
  chart?.destroy();
});
</script>

<template>
  <div class="h-64">
    <canvas ref="canvasRef" />
  </div>
</template>
