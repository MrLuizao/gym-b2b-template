import type { CheckInAlert, CheckInRecord, CheckInResult } from '#shared/types';
import { randomUUID } from 'node:crypto';
import { useMockDb, verifyQrToken } from '../utils/mock-db';

const GRACE_PERIOD_DAYS = 3;

const EXPIRED_MESSAGE = 'Membresía Vencida - Favor de pasar a caja';
const EXPIRING_MESSAGE = 'Membresía por vencer';

interface CheckInBody {
  userId?: string;
  branchId?: string;
  memberNumber?: string;
  issuedAt?: number;
  signature?: string;
  method?: 'qr' | 'usb' | 'manual';
}

function evaluateMembership(
  membershipStatus: string,
  membershipUntil: number | null,
): { granted: boolean; alert: CheckInAlert; message?: string } {
  const now = Date.now();
  if (membershipStatus !== 'ACTIVE') {
    return {
      granted: false,
      alert: 'RED',
      message: 'Membresía Vencida - Favor de pasar a caja',
    };
  }
  if (membershipUntil === null || membershipUntil >= Date.now()) {
    return { granted: true, alert: 'GREEN' };
  }
  const graceEnd = membershipUntil + GRACE_PERIOD_DAYS * 86_400_000;
  if (Date.now() <= graceEnd) {
    return {
      granted: true,
      alert: 'YELLOW',
      message: 'Membresía por vencer',
    };
  }
  return {
    granted: false,
    alert: 'RED',
    message: 'Membresía Vencida - Favor de pasar a caja',
  };
}

export default defineEventHandler(async (event): Promise<CheckInResult> => {
  const db = useMockDb();
  const body = await readBody<{
    userId?: string;
    memberNumber?: string;
    branchId?: string;
    issuedAt?: number;
    signature?: string;
    method?: 'qr' | 'usb' | 'manual';
  }>(event);

  const branchId = body?.branchId ?? db.branches[0]!.id;
  const branch = db.branches.find((b) => b.id === branchId);
  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: 'Sucursal no encontrada' });
  }

  const member = db.members.find(
    (m) => m.id === body.userId || m.memberNumber === body.memberNumber,
  );

  if (!member) {
    return { granted: false, reason: 'MEMBER_NOT_FOUND' };
  }

  if (body.signature) {
    const issuedAt = Number(body.issuedAt ?? 0);
    if (!Number.isFinite(issuedAt) || !verifyQrToken(member.id, issuedAt, body.signature)) {
      return { granted: false, reason: 'QR_INVALID', member };
    }
  }

  const evaluation = evaluateMembership(
    member.membershipStatus,
    member.membershipUntil,
  );

  if (!evaluation.granted) {
    return {
      granted: false,
      alert: 'RED',
      reason: 'MEMBERSHIP_EXPIRED',
      message: EXPIRED_MESSAGE,
      member,
    };
  }

  if (branch.currentCapacity >= branch.maxCapacity) {
    return { granted: false, alert: 'RED', reason: 'BRANCH_FULL', member };
  }

  branch.currentCapacity += 1;

  const record: CheckInRecord = {
    id: randomUUID(),
    userId: member.id,
    branchId: branch.id,
    memberName: member.name,
    membershipType: member.membershipType,
    method: body.method ?? 'qr',
    granted: true,
    checkInAt: Date.now(),
    checkedOut: false,
  };
  db.checkIns.unshift(record);

  const alert: CheckInAlert = evaluation.alert;
  return {
    granted: true,
    alert,
    message: alert === 'YELLOW' ? 'Membresía por vencer' : '',
    member,
    record,
  };
});
