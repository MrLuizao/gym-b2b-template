<script setup lang="ts">
import { QrCode } from '@lucide/vue';

import type { CheckInResult } from '#shared/types';

const { handleScan, recent, lastResult, submitting, loadRecent } = useCheckIns(
  () => 'select',
);

const alertVisible = ref(false);
let alertTimer: ReturnType<typeof setTimeout> | null = null;

async function onDetect(code: string): Promise<void> {
  await handleScan(code);
  alertVisible.value = true;
  if (alertTimer) clearTimeout(alertTimer);
  alertTimer = setTimeout(() => {
    alertVisible.value = false;
  }, 3000);
}

onMounted(() => {
  void loadRecent();
});
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ScannerPanel @detect="onDetect" />

      <div class="space-y-4">
        <MemberCard :member="lastResult?.member ?? null" :result="lastResult" />
        <CheckInsList :records="recent" />
      </div>
    </div>

    <div
      v-if="submitting"
      class="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-stroke bg-surface px-5 py-2 text-xs font-bold text-text-muted shadow-xl"
    >
      Validando acceso…
    </div>

    <AccessAlert :result="lastResult" :visible="alertVisible" />
  </div>
</template>
