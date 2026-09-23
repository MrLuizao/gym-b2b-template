import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import type { CheckInAlert, CheckInResult } from '#shared/types';

import { db, planNameFor, toCheckIn } from '../utils/db';
import { verifyQrToken } from '../utils/qr';
import { requireBranchScope, requireStaff } from '../utils/staff-auth';

const GRACE_PERIOD_DAYS = 3;
const TZ = 'America/Mexico_City';

const EXPIRED_MESSAGE = 'Membresía Vencida - Favor de pasar a caja';
const EXPIRING_MESSAGE = 'Membresía por vencer';

interface MemberData {
  name?: string;
  photo_url?: string;
  member_number?: string;
  membership_status?: string;
  membership_plan_id?: string;
  membership_until?: Timestamp | null;
  active_checkin_id?: string | null;
}

function evaluateMembership(d: MemberData): {
  granted: boolean;
  alert: CheckInAlert;
  message?: string;
  reason?: string;
} {
  const now = Date.now();
  if (d.membership_status !== 'ACTIVE') {
    return {
      granted: false,
      alert: 'RED',
      reason: 'MEMBERSHIP_EXPIRED',
      message: EXPIRED_MESSAGE,
    };
  }
  const until = d.membership_until?.toMillis() ?? null;
  if (until === null || until >= now) {
    return { granted: true, alert: 'GREEN' };
  }
  if (now <= until + GRACE_PERIOD_DAYS * 86_400_000) {
    return { granted: true, alert: 'YELLOW', message: EXPIRING_MESSAGE };
  }
  return {
    granted: false,
    alert: 'RED',
    reason: 'MEMBERSHIP_EXPIRED',
    message: EXPIRED_MESSAGE,
  };
}

/// TTL: próximo cierre de la sede + 2h de margen.
function closeExpiry(closeMinutes: number): Timestamp {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const localMinutes = local.getHours() * 60 + local.getMinutes();
  const closeLocal = new Date(local);
  closeLocal.setHours(Math.floor(closeMinutes / 60), closeMinutes % 60, 0, 0);
  if (localMinutes >= closeMinutes) closeLocal.setDate(closeLocal.getDate() + 1);
  const delta = closeLocal.getTime() - local.getTime();
  return Timestamp.fromMillis(now.getTime() + delta + 120 * 60_000);
}

export default defineEventHandler(async (event): Promise<CheckInResult> => {
  const staff = await requireStaff(event);
  const body = await readBody<{
    userId?: string;
    memberNumber?: string;
    branchId?: string;
    issuedAt?: number;
    signature?: string;
    method?: 'qr' | 'usb' | 'manual';
  }>(event);

  const branchId = body?.branchId ?? staff.branchId ?? '';
  requireBranchScope(staff, branchId);

  const branchSnap = await db().collection('branches').doc(branchId).get();
  if (!branchSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Sucursal no encontrada' });
  }
  const branch = branchSnap.data() ?? {};

  /// Socio por uid o por member_number (lector USB).
  let memberSnap = null as FirebaseFirestore.DocumentSnapshot | null;
  if (body?.userId) {
    const s = await db().collection('users').doc(body.userId).get();
    if (s.exists) memberSnap = s;
  }
  if (!memberSnap && body?.memberNumber) {
    const q = await db()
      .collection('users')
      .where('member_number', '==', body.memberNumber)
      .limit(1)
      .get();
    if (!q.empty) memberSnap = q.docs[0]!;
  }
  if (!memberSnap) {
    return { granted: false, reason: 'MEMBER_NOT_FOUND' };
  }

  const member = (memberSnap.data() ?? {}) as MemberData;
  const planName = await planNameFor(member.membership_plan_id ?? '');
  const memberView = {
    id: memberSnap.id,
    branchId: (memberSnap.get('branch_id') as string) ?? '',
    name: member.name ?? '',
    photoUrl: member.photo_url ?? '',
    membershipStatus:
      member.membership_status === 'EXPIRED'
        ? ('EXPIRED' as const)
        : ('ACTIVE' as const),
    membershipPlanId: member.membership_plan_id ?? '',
    memberNumber: member.member_number ?? '',
    membershipUntil: member.membership_until?.toMillis() ?? null,
    membershipType: planName,
  };

  if (body?.signature) {
    const issuedAt = Number(body.issuedAt ?? 0);
    if (
      !Number.isFinite(issuedAt) ||
      !verifyQrToken(memberSnap.id, issuedAt, body.signature)
    ) {
      return { granted: false, reason: 'QR_INVALID', member: memberView };
    }
  }

  const writeRecord = (
    granted: boolean,
    reason: string | null,
    alert: string | null,
    expires: Timestamp | null,
  ) =>
    db().collection('checkins').add({
      user_id: memberSnap.id,
      branch_id: branchId,
      member_name: member.name ?? '',
      membership_type: planName,
      membership_plan_id: member.membership_plan_id ?? '',
      method: body?.method ?? 'qr',
      granted,
      reason,
      membership_alert: alert,
      check_in_at: FieldValue.serverTimestamp(),
      checked_out: false,
      checked_out_at: null,
      expires_at: expires,
    });

  const evaluation = evaluateMembership(member);
  if (!evaluation.granted) {
    await writeRecord(false, evaluation.reason ?? 'MEMBERSHIP_EXPIRED', 'RED', null);
    return {
      granted: false,
      alert: 'RED',
      reason: evaluation.reason,
      message: evaluation.message,
      member: memberView,
    };
  }

  if (member.active_checkin_id) {
    await writeRecord(false, 'ALREADY_CHECKED_IN', 'YELLOW', null);
    return {
      granted: false,
      alert: 'YELLOW',
      reason: 'ALREADY_CHECKED_IN',
      message: 'El socio ya registró entrada',
      member: memberView,
    };
  }

  const current = Number(branch.current_capacity ?? 0);
  const max = Number(branch.max_capacity ?? 0);
  if (max > 0 && current >= max) {
    await writeRecord(false, 'BRANCH_FULL', 'RED', null);
    return {
      granted: false,
      alert: 'RED',
      reason: 'BRANCH_FULL',
      member: memberView,
    };
  }

  const recordRef = db().collection('checkins').doc();
  const batch = db().batch();
  batch.set(recordRef, {
    user_id: memberSnap.id,
    branch_id: branchId,
    member_name: member.name ?? '',
    membership_type: planName,
    membership_plan_id: member.membership_plan_id ?? '',
    method: body?.method ?? 'qr',
    granted: true,
    reason: null,
    membership_alert: evaluation.alert,
    check_in_at: FieldValue.serverTimestamp(),
    checked_out: false,
    checked_out_at: null,
    expires_at: closeExpiry(Number(branch.close_minutes ?? 1320)),
  });
  batch.update(db().collection('users').doc(memberSnap.id), {
    last_checkin_at: FieldValue.serverTimestamp(),
    active_checkin_id: recordRef.id,
    active_checkin_branch: branchId,
  });
  batch.update(branchSnap.ref, {
    current_capacity: FieldValue.increment(1),
  });
  await batch.commit();

  return {
    granted: true,
    alert: evaluation.alert,
    message: evaluation.message ?? '',
    member: memberView,
    record: toCheckIn(await recordRef.get()),
  };
});
