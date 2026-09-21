import type { CmsResponse, Coupon, MembershipLevel, PromoBanner, PushLog } from '#shared/types';

export interface PromoDraft {
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
  branchId: string | null;
}

export interface CouponDraft {
  title: string;
  description: string;
  badge: string;
  code: string;
  levels: MembershipLevel[];
  branchId: string | null;
}

export interface PushDraft {
  title: string;
  body: string;
  audience: 'ALL' | 'BRANCH' | 'EXPIRED';
  branchId: string | null;
}

export function useCms() {
  const promos = ref<PromoBanner[]>([]);
  const coupons = ref<Coupon[]>([]);
  const pushes = ref<PushLog[]>([]);
  const pending = ref(true);

  async function load(): Promise<void> {
    try {
      const response = await $fetch<CmsResponse>('/api/cms');
      promos.value = response.promos;
      coupons.value = response.coupons;
      pushes.value = response.pushes;
    } finally {
      pending.value = false;
    }
  }

  async function createPromo(draft: PromoDraft): Promise<PromoBanner> {
    const promo = await $fetch<PromoBanner>('/api/cms/promos', {
      method: 'POST',
      body: draft,
    });
    promos.value.unshift(promo);
    return promo;
  }

  async function createCoupon(draft: CouponDraft): Promise<Coupon> {
    const coupon = await $fetch<Coupon>('/api/cms/coupons', {
      method: 'POST',
      body: draft,
    });
    coupons.value.unshift(coupon);
    return coupon;
  }

  async function sendPush(draft: PushDraft): Promise<PushLog> {
    const log = await $fetch<PushLog>('/api/cms/push', {
      method: 'POST',
      body: draft,
    });
    pushes.value.unshift(log);
    return log;
  }

  return { promos, coupons, pushes, pending, load, createPromo, createCoupon, sendPush };
}
