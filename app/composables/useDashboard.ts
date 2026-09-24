import type { Branch, DashboardResponse } from '#shared/types';

export function useDashboard() {
  const data = ref<DashboardResponse | null>(null);
  const pending = ref(true);
  const error = ref<string | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function load(): Promise<void> {
    try {
      data.value = await $api<DashboardResponse>('/api/dashboard');
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

  /// Sedes con ajuste en vuelo — la card las marca busy.
  const adjusting = ref<string[]>([]);

  /// Update optimista: mueve el número al instante (con el mismo clamp
  /// que el server) y luego el POST corrige con el valor real.
  function patchCapacity(branchId: string, apply: (cur: number) => number): void {
    const b = data.value?.branches.find((x) => x.id === branchId);
    if (!b) return;
    const next = apply(b.currentCapacity);
    b.currentCapacity =
      b.maxCapacity > 0 ? Math.min(Math.max(0, next), b.maxCapacity) : Math.max(0, next);
  }

  async function sendAdjust(
    branchId: string,
    body: { delta?: number; value?: number },
  ): Promise<void> {
    if (adjusting.value.includes(branchId)) return;
    adjusting.value = [...adjusting.value, branchId];
    try {
      /// Siempre por API — la regla de Firestore prohíbe a no-admin
      /// tocar current_capacity desde el cliente.
      const updated = await $api<Branch>(`/api/branches/${branchId}/adjust`, {
        method: 'POST',
        body,
      });
      const b = data.value?.branches.find((x) => x.id === branchId);
      if (b) b.currentCapacity = updated.currentCapacity;
      void load(); /// refresca KPIs/tráfico sin bloquear la card
    } finally {
      adjusting.value = adjusting.value.filter((id) => id !== branchId);
    }
  }

  async function adjust(branchId: string, delta: number): Promise<void> {
    patchCapacity(branchId, (cur) => cur + delta);
    await sendAdjust(branchId, { delta });
  }

  /// Fija el aforo en un valor absoluto — el server clampea a [0, max].
  async function setCapacity(branchId: string, value: number): Promise<void> {
    patchCapacity(branchId, () => value);
    await sendAdjust(branchId, { value });
  }

  onScopeDispose(stop);

  return { data, pending, error, start, stop, adjust, setCapacity, adjusting };
}
