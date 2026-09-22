<script setup lang="ts">
import { MapPin } from '@lucide/vue';

import type { Branch, CheckInResult } from '#shared/types';

const { session } = useAuth();

/// El check-in se registra en la sede del staff; el admin (sin sede fija)
/// elige en cuál está operando.
const branches = ref<Branch[]>([]);
const activeBranchId = ref<string>(session.value?.branchId ?? '');

const branchItems = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.id })),
);

const { handleScan, recent, lastResult, submitting, loadRecent } = useCheckIns(
  () => activeBranchId.value,
);

watch(activeBranchId, () => {
  void loadRecent();
});

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

onMounted(async () => {
  if (!activeBranchId.value) {
    branches.value = await $fetch<Branch[]>('/api/branches');
    activeBranchId.value = branches.value[0]?.id ?? '';
  }
  void loadRecent();
});
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="!session?.branchId"
      class="flex items-center gap-3 rounded-2xl border border-stroke bg-surface px-4 py-3"
    >
      <MapPin class="h-4 w-4 shrink-0 text-accent" />
      <span class="text-[11px] font-bold uppercase tracking-widest text-text-dim">
        Operando en
      </span>
      <USelectMenu
        v-model="activeBranchId"
        :items="branchItems"
        value-key="value"
        class="w-48"
      />
    </div>

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
