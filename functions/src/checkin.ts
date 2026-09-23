import { onCall } from 'firebase-functions/v2/https';

import {
  FieldValue,
  HttpsError,
  MemberDoc,
  closeExpiry,
  db,
  evaluateMembership,
  planNameFor,
  requireBranchScope,
  requireStaff,
} from './utils';

interface CheckInPayload {
  userId?: unknown;
  branchId?: unknown;
  method?: unknown;
}

interface MemberSummary {
  id: string;
  name: string;
  photoUrl: string;
  membershipStatus: 'ACTIVE' | 'EXPIRED';
  membershipType: string;
  memberNumber: string;
}

interface CheckInResponse {
  granted: boolean;
  alert: 'GREEN' | 'YELLOW' | 'RED';
  message?: string;
  reason?: string;
  member?: MemberSummary;
}

export const checkIn = onCall(async (request) => {
  const staff = await requireStaff(request);
  const payload = (request.data ?? {}) as CheckInPayload;

  if (typeof payload.userId !== 'string' || typeof payload.branchId !== 'string') {
    throw new HttpsError('invalid-argument', 'userId y branchId son obligatorios');
  }
  const { userId, branchId } = payload;
  const method = typeof payload.method === 'string' ? payload.method : 'qr';
  requireBranchScope(staff, branchId);

  const memberSnap = await db.collection('users').doc(userId).get();
  if (!memberSnap.exists) {
    throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
  }
  const member = (memberSnap.data() ?? {}) as MemberDoc & {
    photo_url?: string;
  };
  const planName = await planNameFor(member.membership_plan_id);

  const summary: MemberSummary = {
    id: userId,
    name: member.name ?? '',
    photoUrl: member.photo_url ?? '',
    membershipStatus:
      member.membership_status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
    membershipType: planName,
    memberNumber: member.member_number ?? '',
  };

  const writeRecord = async (
    granted: boolean,
    reason?: string,
    alert?: string,
  ) => {
    await db.collection('checkins').add({
      user_id: userId,
      branch_id: branchId,
      member_name: member.name ?? '',
      membership_type: planName,
      membership_plan_id: member.membership_plan_id ?? '',
      method,
      granted,
      reason: reason ?? null,
      membership_alert: alert ?? null,
      check_in_at: FieldValue.serverTimestamp(),
      checked_out: false,
      checked_out_at: null,
      expires_at: null,
    });
  };

  const evaluation = evaluateMembership(member);
  if (!evaluation.granted) {
    await writeRecord(false, evaluation.reason, 'RED');
    return {
      granted: false,
      alert: 'RED',
      reason: evaluation.reason,
      message: evaluation.message,
      member: summary,
    } satisfies CheckInResponse;
  }

  if (member.active_checkin_id) {
    await writeRecord(false, 'ALREADY_CHECKED_IN', 'YELLOW');
    return {
      granted: false,
      alert: 'YELLOW',
      reason: 'ALREADY_CHECKED_IN',
      message: 'El socio ya registró entrada',
      member: summary,
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
    await writeRecord(false, 'BRANCH_FULL', 'RED');
    throw new HttpsError('resource-exhausted', 'BRANCH_FULL');
  }

  const recordRef = db.collection('checkins').doc();
  const batch = db.batch();
  batch.set(recordRef, {
    user_id: userId,
    branch_id: branchId,
    member_name: member.name ?? '',
    membership_type: planName,
    membership_plan_id: member.membership_plan_id ?? '',
    method,
    granted: true,
    reason: null,
    membership_alert: evaluation.alert,
    check_in_at: FieldValue.serverTimestamp(),
    checked_out: false,
    checked_out_at: null,
    expires_at: closeExpiry(Number(branch.close_minutes ?? 1320)),
  });
  batch.update(db.collection('users').doc(userId), {
    last_checkin_at: FieldValue.serverTimestamp(),
    active_checkin_id: recordRef.id,
    active_checkin_branch: branchId,
  });
  batch.update(branchRef, { current_capacity: FieldValue.increment(1) });
  await batch.commit();

  return {
    granted: true,
    alert: evaluation.alert,
    message: evaluation.message ?? '',
    member: summary,
  } satisfies CheckInResponse;
});

export const checkOut = onCall(async (request) => {
  const staff = await requireStaff(request);
  const payload = (request.data ?? {}) as { checkInId?: unknown };
  if (typeof payload.checkInId !== 'string') {
    throw new HttpsError('invalid-argument', 'checkInId requerido');
  }

  const ref = db.collection('checkins').doc(payload.checkInId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'CHECKIN_NOT_FOUND');
  }
  const data = snap.data() ?? {};
  requireBranchScope(staff, String(data.branch_id ?? ''));

  if (data.checked_out === true) {
    return { ok: true, already: true };
  }

  const batch = db.batch();
  batch.update(ref, {
    checked_out: true,
    checked_out_at: FieldValue.serverTimestamp(),
  });
  batch.update(db.collection('branches').doc(String(data.branch_id)), {
    current_capacity: FieldValue.increment(-1),
  });
  if (typeof data.user_id === 'string') {
    batch.update(db.collection('users').doc(data.user_id), {
      active_checkin_id: null,
      active_checkin_branch: null,
    });
  }
  await batch.commit();

  return { ok: true };
});
