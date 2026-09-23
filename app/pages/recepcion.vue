<script setup lang="ts">
import { MapPin } from '@lucide/vue';

import type { Branch } from '#shared/types';

const { session } = useAuth();

/// El check-in se registra en la sede del staff; el admin (sin sede fija)
/// elige en cuál está operando.
const branches = ref<Branch[]>([]);
const activeBranchId = ref<string>(session.value?.branchId ?? '');

const branchItems = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.id })),
);

/// Gerente y recepcionista operan su sede fija — ven el selector bloqueado.
const branchLocked = computed(() => !!session.value?.branchId);

const { handleScan, recent, lastResult, submitting, loadRecent } = useCheckIns(
  () => activeBranchId.value,
);

watch(activeBranchId, () => {
  void loadRecent();
});

async function onDetect(code: string): Promise<void> {
  await handleScan(code);
}

onMounted(async () => {
  branches.value = await $api<Branch[]>('/api/branches');
  if (!activeBranchId.value) {
    activeBranchId.value = branches.value[0]?.id ?? '';
  }
  void loadRecent();
});
</script>

<template>
  <div class="flex min-h-[calc(100vh-6rem)] flex-col gap-6">
    <h1 class="text-xl font-black text-text-primary">Recepción</h1>

    <div class="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-5">
      <div class="flex flex-col gap-4 lg:col-span-3">
        <ScannerPanel @detect="onDetect" />
        <ScanResultPanel :result="lastResult" :pending="submitting" />
      </div>

      <div class="flex flex-col gap-4 self-start lg:col-span-2">
        <div>
          <span
            class="flex items-center gap-2 text-sm font-black tracking-tight text-text-primary"
          >
            <MapPin class="h-4 w-4 text-accent" />
            Operando en
          </span>
          <USelectMenu
            v-model="activeBranchId"
            :items="branchItems"
            value-key="value"
            :disabled="branchLocked"
            class="mt-1 w-full"
          />
        </div>
        <CheckInsList :records="recent" />
      </div>
    </div>
  </div>
</template>
