/// Estado compartido del cierre de sede — el header dispara el cierre y
/// las BranchCard marcan "Cerrando…" mientras el barrido está en vuelo.
/// useState lo hace global: layout y páginas ven el mismo estado.
export function useCloseDay() {
  const closing = useState<string[]>('closeDay:closing', () => []);

  /// Archiva los check-ins abiertos a dailyStats y resetea el aforo.
  /// Devuelve cuántos registros se barrió.
  async function closeDay(branchId: string): Promise<number> {
    if (closing.value.includes(branchId)) return 0;
    closing.value = [...closing.value, branchId];
    try {
      const res = await $api<{ swept: number }>(
        `/api/branches/${branchId}/close-day`,
        { method: 'POST' },
      );
      return res.swept;
    } finally {
      closing.value = closing.value.filter((id) => id !== branchId);
    }
  }

  return { closing, closeDay };
}
