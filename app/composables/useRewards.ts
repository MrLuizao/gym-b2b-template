import type { Branch, Reward, RewardRedemption } from '#shared/types';

export interface RewardDraft {
  name: string;
  description: string;
  pointsCost: number;
  icon: string;
}

export interface LoyaltyStats {
  pointsIssued: number;
  pointsOutstanding: number;
  goalsThisWeek: number;
  weekKey: string;
}

export interface BranchRedemptions {
  branchId: string;
  branchName: string;
  count: number;
  points: number;
}

/// Lealtad — catálogo /rewards (admin edita, staff ve) + canjes de
/// socios (staff valida el código en recepción).
export function useRewards() {
  const rewards = ref<Reward[]>([]);
  const redemptions = ref<RewardRedemption[]>([]);
  const stats = ref<LoyaltyStats | null>(null);
  const branches = ref<Branch[]>([]);
  const pending = ref(true);

  /// Canjes agrupados por sede — para comparar tracción entre branches.
  const redemptionsByBranch = computed<BranchRedemptions[]>(() => {
    const names = new Map(branches.value.map((b) => [b.id, b.name]));
    const byBranch = new Map<string, { count: number; points: number }>();
    for (const r of redemptions.value) {
      const key = r.branchId || '_';
      const acc = byBranch.get(key) ?? { count: 0, points: 0 };
      acc.count += 1;
      acc.points += r.pointsSpent;
      byBranch.set(key, acc);
    }
    return [...byBranch.entries()]
      .map(([branchId, v]) => ({
        branchId,
        branchName: names.get(branchId) ?? branchId,
        ...v,
      }))
      .sort((a, b) => b.count - a.count);
  });

  async function load(): Promise<void> {
    try {
      const [r, red, s, b] = await Promise.all([
        $api<Reward[]>('/api/rewards'),
        $api<RewardRedemption[]>('/api/rewards/redemptions'),
        $api<LoyaltyStats>('/api/rewards/stats'),
        $api<Branch[]>('/api/branches'),
      ]);
      rewards.value = r;
      redemptions.value = red;
      stats.value = s;
      branches.value = b;
    } finally {
      pending.value = false;
    }
  }

  async function createReward(draft: RewardDraft): Promise<Reward> {
    const reward = await $api<Reward>('/api/rewards', {
      method: 'POST',
      body: draft,
    });
    rewards.value.push(reward);
    rewards.value.sort((a, b) => a.pointsCost - b.pointsCost);
    return reward;
  }

  async function updateReward(
    reward: Reward,
    patch: Partial<RewardDraft> & { active?: boolean },
  ): Promise<void> {
    const updated = await $api<Reward>(`/api/rewards/${reward.id}`, {
      method: 'PUT',
      body: patch,
    });
    Object.assign(reward, updated);
  }

  /// Marca un código de canje como usado — recepción lo hace al
  /// entregar la recompensa al socio.
  async function useCode(code: string): Promise<RewardRedemption> {
    const used = await $api<RewardRedemption>('/api/rewards/redemptions', {
      method: 'POST',
      body: { code },
    });
    const idx = redemptions.value.findIndex((r) => r.id === used.id);
    if (idx >= 0) redemptions.value[idx] = used;
    else redemptions.value.unshift(used);
    return used;
  }

  return {
    rewards,
    redemptions,
    stats,
    redemptionsByBranch,
    pending,
    load,
    createReward,
    updateReward,
    useCode,
  };
}
