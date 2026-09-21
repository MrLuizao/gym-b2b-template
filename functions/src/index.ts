import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();

const db = getFirestore();

const IDLE_LIMIT_MINUTES = 90;
const GRACE_PERIOD_DAYS = 3;

const EXPIRED_MESSAGE = 'Membresía Vencida - Favor de pasar a caja';
const EXPIRING_MESSAGE = 'Membresía por vencer';

interface CheckInPayload {
  userId?: unknown;
  branchId?: unknown;
}

interface MemberDoc {
  name?: string;
  membership_status?: string;
  membership_type?: string;
  member_number?: string;
  membership_until?: Timestamp | { toDate?: () => Date } | null;
  membership?: {
    status?: string;
    expiration_date?: Timestamp | { toDate?: () => Date } | null;
  };
}

interface CheckInResponse {
  granted: boolean;
  alert: 'GREEN' | 'YELLOW' | 'RED';
  message?: string;
  reason?: string;
  member?: {
    id: string;
    name: string;
    photoUrl: string;
    membershipStatus: 'ACTIVE' | 'EXPIRED';
    membershipType: string;
    memberNumber: string;
  };
}

function resolveExpiration(member: MemberDoc): Date | null {
  const raw = member.membership?.expiration_date ?? member.membership_until;
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    return raw.toDate?.() ?? null;
  }
  return null;
}

function evaluateMembership(member: MemberDoc): {
  alert: 'GREEN' | 'YELLOW' | 'RED';
  granted: boolean;
  message?: string;
  reason?: string;
  status: 'ACTIVE' | 'EXPIRED';
} {
  const status = member.membership?.status ?? member.membership_status ?? 'ACTIVE';
  const expiration = resolveExpiration(member);
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
  const graceEnd = expirationMs + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

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

export const onCheckIn = onCall(async (request) => {
  const payload = (request.data ?? {}) as CheckInPayload;

  if (typeof payload.userId !== 'string' || typeof payload.branchId !== 'string') {
    throw new HttpsError(
      'invalid-argument',
      'userId y branchId son obligatorios',
    );
  }
  const { userId, branchId } = payload;

  const memberSnap = await db.collection('users').doc(userId).get();
  if (!memberSnap.exists) {
    throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
  }

  const member = (memberSnap.data() ?? {}) as MemberDoc;

  const evaluation = evaluateMembership(member);
  if (!evaluation.granted) {
    return {
      granted: false,
      alert: 'RED' as const,
      reason: evaluation.reason,
      message: evaluation.message,
      member: {
        id: userId,
        name: member.name ?? '',
        photoUrl: '',
        membershipStatus: 'EXPIRED' as const,
        membershipType: member.membership_type ?? '',
        memberNumber: member.member_number ?? '',
      },
    } satisfies CheckInResponse;
  }

  const branchRef = db.collection('branches').doc(branchId);
  const branchSnap = await branchRef.get();
  if (!branchSnap.exists) {
    throw new HttpsError('not-found', 'BRANCH_NOT_FOUND');
  }

  const branch = branchSnap.data() ?? {};
  const current = Number(branch.current_capacity ?? 0);
  const max = Number(branch.max_capacity ?? 0);
  if (max > 0 && current >= max) {
    throw new HttpsError('resource-exhausted', 'BRANCH_FULL');
  }

  const recordRef = db.collection('checkins').doc();
  await recordRef.set({
    userId,
    branchId,
    memberName: member.name ?? '',
    membershipType: member.membership_type ?? '',
    method: 'qr',
    granted: true,
    membershipAlert: evaluation.alert,
    membershipMessage: evaluation.message ?? null,
    checkInAt: FieldValue.serverTimestamp(),
    checkedOut: false,
  });

  await branchRef.update({ current_capacity: FieldValue.increment(1) });

  return {
    granted: true,
    alert: evaluation.alert,
    message: evaluation.message ?? '',
    member: {
      id: userId,
      name: member.name ?? '',
      photoUrl: '',
      membershipStatus: 'ACTIVE' as const,
      membershipType: member.membership_type ?? '',
      memberNumber: member.member_number ?? '',
    },
  };
});

export const autoCheckoutCron = onSchedule('every 15 minutes', async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - IDLE_LIMIT_MINUTES * 60_000);

  const stale = await db
    .collection('checkins')
    .where('checkedOut', '==', false)
    .where('checkInAt', '<', cutoff)
    .get();

  if (stale.empty) {
    return;
  }

  const releasedByBranch = new Map<string, number>();
  const batch = db.batch();

  stale.forEach((doc) => {
    batch.update(doc.ref, {
      checkedOut: true,
      checkedOutAt: FieldValue.serverTimestamp(),
      releaseReason: 'auto_checkout_cron',
    });
    const branchId = String(doc.get('branchId') ?? '');
    releasedByBranch.set(branchId, (releasedByBranch.get(branchId) ?? 0) + 1);
  });

  await batch.commit();

  for (const [branchId, count] of releasedByBranch) {
    await db
      .collection('branches')
      .doc(branchId)
      .update({ current_capacity: FieldValue.increment(-count) });
  }
});
