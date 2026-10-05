import type { RewardRedemption } from '#shared/types';

import { db, toMs } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

/// GET /api/rewards/redemptions — canjes de socios. Staff con sede ve
/// solo los de su sede (`branch_id` va embebido en el doc); admin ve
/// todos. Orden en memoria — sin índice compuesto en collection group.
export default defineEventHandler(
  async (event): Promise<RewardRedemption[]> => {
    const staff = await requireStaff(event);

    let query: FirebaseFirestore.Query = db().collectionGroup('redemptions');
    if (staff.role !== 'ADMIN') {
      query = query.where('branch_id', '==', staff.branchId ?? '_');
    }
    const snap = await query.limit(300).get();
    const now = Date.now();

    return snap.docs
      .map((doc) => {
        const d = doc.data();
        const expiresAt = toMs(d.expires_at) ?? 0;
        let status = String(d.status ?? 'active');
        if (status === 'active' && expiresAt > 0 && expiresAt < now) {
          status = 'expired';
        }
        return {
          id: doc.id,
          memberId: String(d.member_id ?? doc.ref.parent.parent?.id ?? ''),
          memberName: String(d.member_name ?? ''),
          branchId: String(d.branch_id ?? ''),
          rewardId: String(d.reward_id ?? ''),
          rewardName: String(d.reward_name ?? ''),
          pointsSpent: Number(d.points_spent ?? 0),
          code: String(d.code ?? ''),
          status: status as RewardRedemption['status'],
          createdAt: toMs(d.created_at) ?? 0,
          expiresAt,
          usedAt: toMs(d.used_at),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
);
