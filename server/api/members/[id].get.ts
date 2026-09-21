import type { MemberAdmin, MemberDetail, MembershipLevel } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

const GRACE_PERIOD_DAYS = 3;

function levelFromPlan(plan: string): MembershipLevel {
  const normalized = plan.toLowerCase();
  if (normalized.includes('black')) return 'BLACK';
  if (normalized.includes('plus')) return 'PLUS';
  return 'CLASSIC';
}

export default defineEventHandler((event): MemberDetail => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const now = Date.now();
  const graceMs = 3 * 86_400_000;

  const member = db.members.find((m) => m.id === id);
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }

  let adminStatus: MemberAdmin['adminStatus'] = 'ACTIVE';
  if (member.membershipStatus !== 'ACTIVE') {
    adminStatus = 'EXPIRED';
  } else if (member.membershipUntil !== null) {
    if (member.membershipUntil < now) {
      adminStatus =
        member.membershipUntil + graceMs >= now ? 'EXPIRING' : 'EXPIRED';
    } else if (member.membershipUntil - now <= graceMs) {
      adminStatus = 'EXPIRING';
    }
  }

  const plan = db.plans.find((p) => p.name === member.membershipType);
  const level: MembershipLevel =
    plan?.level ?? levelFromPlan(member.membershipType);

  const checkIns = db.checkIns
    .filter((c) => c.userId === id)
    .sort((a, b) => b.checkInAt - a.checkInAt);

  const payments = db.payments
    .filter((p) => p.memberName === member.name)
    .sort((a, b) => b.createdAt - a.createdAt);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return {
    member: {
      ...member,
      membershipLevel: level,
      adminStatus,
      allBranchesAccess: plan?.allBranches ?? false,
    },
    checkIns,
    payments,
    stats: {
      totalCheckIns: db.checkIns.filter(
        (c) => c.userId === id && c.granted,
      ).length,
      monthCheckIns: db.checkIns.filter(
        (c) =>
          c.userId === id &&
          c.granted &&
          c.checkInAt >= monthStart.getTime(),
      ).length,
    },
  };
});
