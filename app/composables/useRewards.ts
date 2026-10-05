import type { Reward, RewardRedemption } from '#shared/types';

export interface RewardDraft {
  name: string;
  description: string;
  pointsCost: number;
  icon: string;
}

/// Lealtad — catálogo /rewards (admin edita, staff ve) + canjes de
/// socios (staff valida el código en recepción).
export function useRewards() {
  const rewards = ref<Reward[]>([]);
  const redemptions = ref<RewardRedemption[]>([]);
  const pending = ref(true);

  async function load(): Promise<void> {
    try {
      const [r, red] = await Promise.all([
        $api<Reward[]>('/api/rewards'),
        $api<RewardRedemption[]>('/api/rewards/redemptions'),
      ]);
      rewards.value = r;
      redemptions.value = red;
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

  return { rewards, redemptions, pending, load, createReward, updateReward, useCode };
}
