import { doc, increment, updateDoc } from 'firebase/firestore';

import type { DashboardResponse } from '#shared/types';

export function useDashboard() {
  const firebase = useFirebase();
  const data = ref<DashboardResponse | null>(null);
  const pending = ref(true);
  const error = ref<string | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function load(): Promise<void> {
    try {
      data.value = await $fetch<DashboardResponse>('/api/dashboard');
      error.value = null;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Error de red';
    } finally {
      pending.value = false;
    }
  }

  function start(): void {
    void load();
    timer = setInterval(() => void load(), 5000);
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function adjust(branchId: string, delta: number): Promise<void> {
    if (firebase.enabled && firebase.db) {
      await updateDoc(doc(firebase.db, 'branches', branchId), {
        current_capacity: increment(delta),
      });
      return;
    }
    await $fetch(`/api/branches/${branchId}/adjust`, {
      method: 'POST',
      body: { delta },
    });
    await load();
  }

  onScopeDispose(stop);

  return { data, pending, error, start, stop, adjust };
}
