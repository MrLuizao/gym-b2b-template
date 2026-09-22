import type { CmsResponse, Coupon, MembershipLevel, PromoBanner, PushLog, SponsorAd } from '#shared/types';

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
  kind: PushLog['kind'];
  scheduledAt?: number | null;
}

export interface AdDraft {
  advertiser: string;
  title: string;
  subtitle: string;
  badge: string;
  brandColor?: number | null;
  imageUrl: string;
  ctaLabel: string;
  branchId: string | null;
  endsAt: number;
  status?: SponsorAd['status'];
  description?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string;
  socials?: SponsorAd['socials'];
  photos?: string[];
}

export function useCms() {
  const promos = ref<PromoBanner[]>([]);
  const coupons = ref<Coupon[]>([]);
  const pushes = ref<PushLog[]>([]);
  const ads = ref<SponsorAd[]>([]);
  const pending = ref(true);

  async function load(): Promise<void> {
    try {
      const response = await $fetch<CmsResponse>('/api/cms');
      promos.value = response.promos;
      coupons.value = response.coupons;
      pushes.value = response.pushes;
      ads.value = response.ads;
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

  /// Crea la notificación como borrador — no envía nada todavía.
  async function createPush(draft: PushDraft): Promise<PushLog> {
    const log = await $fetch<PushLog>('/api/cms/push', {
      method: 'POST',
      body: draft,
    });
    pushes.value.unshift(log);
    return log;
  }

  async function updateCoupon(
    coupon: Coupon,
    draft: Partial<CouponDraft>,
  ): Promise<void> {
    const updated = await $fetch<Coupon>(`/api/cms/coupons/${coupon.id}`, {
      method: 'PUT',
      body: draft,
    });
    Object.assign(coupon, updated);
  }

  async function deleteCoupon(coupon: Coupon): Promise<void> {
    await $fetch(`/api/cms/coupons/${coupon.id}`, { method: 'DELETE' });
    coupons.value = coupons.value.filter((item) => item.id !== coupon.id);
  }

  /// Edita un borrador de notificación (los enviados son de solo lectura).
  async function updatePush(
    log: PushLog,
    draft: Partial<PushDraft>,
  ): Promise<void> {
    const updated = await $fetch<PushLog>(`/api/cms/push/${log.id}`, {
      method: 'PUT',
      body: draft,
    });
    Object.assign(log, updated);
  }

  async function deletePush(log: PushLog): Promise<void> {
    await $fetch(`/api/cms/push/${log.id}`, { method: 'DELETE' });
    pushes.value = pushes.value.filter((item) => item.id !== log.id);
  }

  /// Lanza el envío de un borrador ya guardado.
  async function sendPush(log: PushLog): Promise<void> {
    const sent = await $fetch<PushLog>(`/api/cms/push/${log.id}/send`, {
      method: 'POST',
    });
    Object.assign(log, sent);
  }

  async function createAd(draft: AdDraft): Promise<SponsorAd> {
    const ad = await $fetch<SponsorAd>('/api/cms/ads', {
      method: 'POST',
      body: draft,
    });
    ads.value.unshift(ad);
    return ad;
  }

  async function updateAdStatus(
    ad: SponsorAd,
    status: SponsorAd['status'],
  ): Promise<void> {
    const updated = await $fetch<SponsorAd>(`/api/cms/ads/${ad.id}`, {
      method: 'PUT',
      body: { status },
    });
    Object.assign(ad, updated);
  }

  async function updateAd(
    ad: SponsorAd,
    draft: Partial<AdDraft> & { status?: SponsorAd['status'] },
  ): Promise<void> {
    const updated = await $fetch<SponsorAd>(`/api/cms/ads/${ad.id}`, {
      method: 'PUT',
      body: draft,
    });
    Object.assign(ad, updated);
  }

  async function deleteAd(ad: SponsorAd): Promise<void> {
    await $fetch(`/api/cms/ads/${ad.id}`, { method: 'DELETE' });
    ads.value = ads.value.filter((item) => item.id !== ad.id);
  }

  return {
    promos,
    coupons,
    pushes,
    ads,
    pending,
    load,
    createPromo,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    createPush,
    updatePush,
    deletePush,
    sendPush,
    createAd,
    updateAd,
    updateAdStatus,
    deleteAd,
  };
}
