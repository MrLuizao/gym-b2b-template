import type {
  CheckInRecord,
  CheckInResult,
  PartnerProvider,
} from '#shared/types';

const REASON_LABELS: Record<string, string> = {
  MEMBER_NOT_FOUND: 'Socio no registrado',
  MEMBERSHIP_EXPIRED: 'Membresía Vencida - Favor de pasar a caja',
  BRANCH_FULL: 'Aforo completo',
  QR_INVALID: 'Código QR inválido',
  PLAN_BRANCH_RESTRICTED: 'Su plan no cubre esta sede',
  PARTNER_TOKEN_INVALID: 'Token de agregador inválido o expirado',
  ALREADY_CHECKED_IN: 'Ya registró entrada',
};

export const EXPIRING_MESSAGE = 'Membresía por vencer';

type ParsedScan =
  | { mode: 'signed'; uid: string; ts: number; sig: string }
  | { mode: 'plain'; code: string };

function parseScan(raw: string): ParsedScan {
  try {
    const parsed = JSON.parse(raw) as { uid?: unknown; ts?: unknown; sig?: unknown };
    if (
      parsed &&
      typeof parsed.uid === 'string' &&
      typeof parsed.ts === 'number' &&
      typeof parsed.sig === 'string'
    ) {
      return { mode: 'signed', uid: parsed.uid, ts: parsed.ts, sig: parsed.sig };
    }
  } catch {
    // Contenido no-JSON: UID o número de socio en texto plano (lector USB).
  }
  return { mode: 'plain', code: raw };
}

export function useCheckIns(branchId: MaybeRefOrGetter<string>) {
  const recent = ref<CheckInRecord[]>([]);
  const lastResult = ref<CheckInResult | null>(null);
  const submitting = ref(false);

  async function loadRecent(): Promise<void> {
    try {
      recent.value = await $api<CheckInRecord[]>('/api/checkins', {
        query: { limit: 5, branchId: toValue(branchId) },
      });
    } catch {
      recent.value = [];
    }
  }

  async function handleScan(rawCode: string): Promise<CheckInResult> {
    const code = rawCode.trim();
    if (!code) {
      return { granted: false, reason: 'QR_INVALID' };
    }

    submitting.value = true;
    try {
      const result = await dispatch(code);
      lastResult.value = result;
      await loadRecent();
      return result;
    } finally {
      submitting.value = false;
    }
  }

  /// Todo pasa por el REST /api/checkin — resuelve por member_number
  /// (lector USB, número tecleado o QR de la app) y verifica la firma
  /// en modo QR. La rama de callable esperaba QR firmados heredados y
  /// rechazaba el número plano antes de llegar al backend.
  async function dispatch(code: string): Promise<CheckInResult> {
    const parsed = parseScan(code);
    const branch = toValue(branchId);
    return $api<CheckInResult>('/api/checkin', {
      method: 'POST',
      body:
        parsed.mode === 'signed'
          ? {
              method: 'qr' as const,
              userId: parsed.uid,
              issuedAt: parsed.ts,
              signature: parsed.sig,
              branchId: branch,
            }
          : {
              method: 'usb' as const,
              memberNumber: parsed.code,
              branchId: branch,
            },
    });
  }

  /// Check-in de agregador: el token del día (Wellhub/TotalPass) lo
  /// valida el server contra la API del proveedor (mock en dev).
  async function handlePartnerScan(
    provider: PartnerProvider,
    token: string,
  ): Promise<CheckInResult> {
    submitting.value = true;
    try {
      const result = await $api<CheckInResult>('/api/partners/checkin', {
        method: 'POST',
        body: { provider, token: token.trim(), branchId: toValue(branchId) },
      });
      lastResult.value = result;
      await loadRecent();
      return result;
    } finally {
      submitting.value = false;
    }
  }

  return { recent, lastResult, submitting, loadRecent, handleScan, handlePartnerScan };
}

export function reasonLabel(reason?: string): string {
  if (!reason) return 'Acceso concedido';
  return REASON_LABELS[reason] ?? 'Acceso denegado';
}
