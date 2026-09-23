import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

initializeApp();

export const db = getFirestore();

export const GRACE_PERIOD_DAYS = 3;
export const MEMBERSHIP_PERIOD_DAYS = 30;
export const IDLE_LIMIT_MINUTES = 90;
export const BRAND_TIMEZONE = 'America/Mexico_City';

export const EXPIRED_MESSAGE = 'Membresía Vencida - Favor de pasar a caja';
export const EXPIRING_MESSAGE = 'Membresía por vencer';

export interface StaffContext {
  uid: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST';
  branchId: string | null;
}

/// Lee /staff/{uid} del caller — misma fuente de verdad que las reglas.
export async function requireStaff(
  request: CallableRequest,
): Promise<StaffContext> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sesión requerida');
  }
  const snap = await db.collection('staff').doc(request.auth.uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No eres staff');
  }
  const data = snap.data() ?? {};
  return {
    uid: request.auth.uid,
    role: (data.role as StaffContext['role']) ?? 'RECEPTIONIST',
    branchId: (data.branch_id as string | null) ?? null,
  };
}

/// El caller debe operar en `branchId` salvo que sea ADMIN global.
export function requireBranchScope(staff: StaffContext, branchId: string) {
  if (staff.role === 'ADMIN') return;
  if (staff.branchId !== branchId) {
    throw new HttpsError('permission-denied', 'Fuera de tu sede');
  }
}

export interface MemberDoc {
  name?: string;
  membership_status?: string;
  membership_plan_id?: string;
  member_number?: string;
  membership_until?: Timestamp | null;
  active_checkin_id?: string | null;
  active_checkin_branch?: string | null;
}

export interface MembershipEval {
  alert: 'GREEN' | 'YELLOW' | 'RED';
  granted: boolean;
  message?: string;
  reason?: string;
  status: 'ACTIVE' | 'EXPIRED';
}

export function evaluateMembership(member: MemberDoc): MembershipEval {
  const status = member.membership_status ?? 'ACTIVE';
  const expiration = member.membership_until?.toDate() ?? null;
  const now = Date.now();

  if (status !== 'ACTIVE') {
    return {
      alert: 'RED',
      granted: false,
      reason: 'MEMBERSHIP_EXPIRED',
      status: 'EXPIRED',
    };
  }
  if (!expiration) {
    return { alert: 'GREEN', granted: true, status: 'ACTIVE' };
  }

  const expirationMs = expiration.getTime();
  const graceEnd = expirationMs + GRACE_PERIOD_DAYS * 86_400_000;

  if (now <= expirationMs) {
    return { alert: 'GREEN', granted: true, status: 'ACTIVE' };
  }
  if (now <= graceEnd) {
    return {
      alert: 'YELLOW',
      granted: true,
      message: EXPIRING_MESSAGE,
      status: 'ACTIVE',
    };
  }
  return {
    alert: 'RED',
    granted: false,
    reason: 'MEMBERSHIP_EXPIRED',
    message: EXPIRED_MESSAGE,
    status: 'EXPIRED',
  };
}

export async function planNameFor(planId: string | undefined): Promise<string> {
  if (!planId) return '';
  const snap = await db.collection('plans').doc(planId).get();
  return (snap.data()?.name as string | undefined) ?? '';
}

/// Timestamp del próximo cierre de sede + margen — TTL del check-in.
export function closeExpiry(
  closeMinutes: number,
  marginMinutes = 120,
): Timestamp {
  const now = new Date();
  const local = new Date(
    now.toLocaleString('en-US', { timeZone: BRAND_TIMEZONE }),
  );
  const localMinutes = local.getHours() * 60 + local.getMinutes();
  const closeLocal = new Date(local);
  closeLocal.setHours(
    Math.floor(closeMinutes / 60),
    closeMinutes % 60,
    0,
    0,
  );
  if (localMinutes >= closeMinutes) {
    closeLocal.setDate(closeLocal.getDate() + 1);
  }
  const delta = closeLocal.getTime() - local.getTime();
  return Timestamp.fromMillis(
    now.getTime() + delta + marginMinutes * 60_000,
  );
}

/// Fecha local yyyy-mm-dd para ids de dailyStats.
export function localDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAND_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/// Extiende la membresía del socio desde max(now, vigencia actual).
export function extendedUntil(member: MemberDoc): Timestamp {
  const current = member.membership_until?.toMillis() ?? 0;
  const base = Math.max(Date.now(), current);
  return Timestamp.fromMillis(base + MEMBERSHIP_PERIOD_DAYS * 86_400_000);
}

export { FieldValue, Timestamp, HttpsError };
