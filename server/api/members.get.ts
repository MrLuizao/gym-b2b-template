import type { MemberAdmin, MembershipLevel } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

const GRACE_PERIOD_DAYS = 3;

function levelFromPlan(plan: string): MembershipLevel {
  const normalized = plan.toLowerCase();
  if (normalized.includes('black')) return 'BLACK';
  if (normalized.includes('plus')) return 'PLUS';
  return 'CLASSIC';
}

export default defineEventHandler((): MemberAdmin[] => {
  const db = useMockDb();
  const now = Date.now();
  const graceMs = 3 * 86_400_000;

  return db.members.map((member) => {
    let adminStatus: MemberAdmin['adminStatus'] = 'ACTIVE';
    if (member.membershipStatus !== 'ACTIVE') {
      adminStatus = 'EXPIRED';
    } else if (member.membershipUntil !== null) {
      if (member.membershipUntil < now) {
        adminStatus =
          member.membershipUntil + 3 * 86_400_000 >= now
            ? 'EXPIRING'
            : 'EXPIRED';
      } else if (member.membershipUntil - now <= 3 * 86_400_000) {
        adminStatus = 'EXPIRING';
      }
    }

    const plan = db.plans.find((p) => p.name === member.membershipType);
    const level: MembershipLevel =
      plan?.level ?? levelFromPlan(member.membershipType);

    return {
      ...member,
      membershipLevel: level,
      adminStatus,
      allBranchesAccess: plan?.allBranches ?? false,
    };
  });
});
