import { httpsCallable } from 'firebase/functions';

import type { CheckInRecord, CheckInResult } from '#shared/types';

const REASON_LABELS: Record<string, string> = {
  MEMBER_NOT_FOUND: 'Socio no registrado',
  MEMBERSHIP_EXPIRED: 'Membresía Vencida - Favor de pasar a caja',
  BRANCH_FULL: 'Aforo completo',
  QR_INVALID: 'Código QR inválido',
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
  const firebase = useFirebase();
  const recent = ref<CheckInRecord[]>([]);
  const lastResult = ref<CheckInResult | null>(null);
  const submitting = ref(false);

  async function loadRecent(): Promise<void> {
    try {
      recent.value = await $fetch<CheckInRecord[]>('/api/checkins', {
        query: { limit: 8, branchId: toValue(branchId) },
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

  async function dispatch(code: string): Promise<CheckInResult> {
    const parsed = parseScan(code);

    if (firebase.enabled && firebase.functions) {
      if (parsed.mode !== 'signed') {
        return { granted: false, reason: 'QR_INVALID' };
      }
      const checkIn = httpsCallable<
        { userId: string; branchId: string },
        CheckInResult
      >(firebase.functions, 'onCheckIn');
      try {
        const response = await checkIn({ userId: parsed.uid, branchId: toValue(branchId) });
        return response.data;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'QR_INVALID';
        return { granted: false, reason: message };
      }
    }

    const branch = toValue(branchId);
    return $fetch<CheckInResult>('/api/checkin', {
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

  return { recent, lastResult, submitting, loadRecent, handleScan };
}

export function reasonLabel(reason?: string): string {
  if (!reason) return 'Acceso concedido';
  return REASON_LABELS[reason] ?? 'Acceso denegado';
}
