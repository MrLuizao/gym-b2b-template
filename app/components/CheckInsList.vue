<script setup lang="ts">
import type { CheckInRecord } from '#shared/types';

defineProps<{ records: CheckInRecord[] }>();

function timeOf(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="rounded-2xl border border-stroke bg-surface p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-black tracking-tight text-text-primary">
        Registro de accesos
      </h2>
      <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
        Últimos 8
      </span>
    </div>

    <ul class="mt-4 space-y-2">
      <li
        v-for="record in records"
        :key="record.id"
        class="flex items-center gap-3 rounded-xl border border-stroke bg-base px-4 py-3"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :class="record.granted ? 'bg-emerald-400' : 'bg-red-400'"
        />
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="block max-w-full cursor-pointer truncate text-xs font-bold text-text-primary transition hover:text-accent hover:underline"
            @click="navigateTo(`/socios/${record.userId}`)"
          >
            {{ record.memberName }}
          </button>
          <p class="text-[10px] font-medium text-text-dim">
            {{ record.membershipType }} · {{ record.method.toUpperCase() }}
            <template v-if="!record.granted"> · {{ record.reason }}</template>
          </p>
        </div>
        <span class="font-mono text-[10px] text-text-dim">
          {{ timeOf(record.checkInAt) }}
        </span>
      </li>
    </ul>

    <p
      v-if="records.length === 0"
      class="py-8 text-center text-xs font-semibold text-text-dim"
    >
      Sin registros todavía
    </p>
  </div>
</template>
