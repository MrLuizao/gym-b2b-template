import type { AdOrder, AdSelfServeConfig, CmsResponse, Coupon, PromoBanner, PushLog, SponsorAd } from '#shared/types';

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
  /// 'ALL' = todos los socios; si no, ids de planes específicos.
  planIds: string[];
  branchId: string | null;
}

export interface PushDraft {
  title: string;
  body: string;
  audience: 'ALL' | 'BRANCH' | 'EXPIRED';
  branchId: string | null;
  kind: PushLog['kind'];
  target?: PushLog['target'];
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
  placement?: SponsorAd['placement'];
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
  /// Solicitudes self-serve (/adOrders) + precios de venta directa.
  const orders = ref<AdOrder[]>([]);
  const adsConfig = ref<AdSelfServeConfig | null>(null);
  const pending = ref(true);

  async function load(): Promise<void> {
    try {
      const response = await $api<CmsResponse>('/api/cms');
      promos.value = response.promos;
      coupons.value = response.coupons;
      pushes.value = response.pushes;
      ads.value = response.ads;
    } finally {
      pending.value = false;
    }
  }

  async function createPromo(draft: PromoDraft): Promise<PromoBanner> {
    const promo = await $api<PromoBanner>('/api/cms/promos', {
      method: 'POST',
      body: draft,
    });
    promos.value.unshift(promo);
    return promo;
  }

  async function createCoupon(draft: CouponDraft): Promise<Coupon> {
    const coupon = await $api<Coupon>('/api/cms/coupons', {
      method: 'POST',
      body: draft,
    });
    coupons.value.unshift(coupon);
    return coupon;
  }

  /// Crea la notificación como borrador — no envía nada todavía.
  async function createPush(draft: PushDraft): Promise<PushLog> {
    const log = await $api<PushLog>('/api/cms/push', {
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
    const updated = await $api<Coupon>(`/api/cms/coupons/${coupon.id}`, {
      method: 'PUT',
      body: draft,
    });
    Object.assign(coupon, updated);
  }

  async function deleteCoupon(coupon: Coupon): Promise<void> {
    await $api(`/api/cms/coupons/${coupon.id}`, { method: 'DELETE' });
    coupons.value = coupons.value.filter((item) => item.id !== coupon.id);
  }

  /// Edita un borrador de notificación (los enviados son de solo lectura).
  async function updatePush(
    log: PushLog,
    draft: Partial<PushDraft>,
  ): Promise<void> {
    const updated = await $api<PushLog>(`/api/cms/push/${log.id}`, {
      method: 'PUT',
      body: draft,
    });
    Object.assign(log, updated);
  }

  async function deletePush(log: PushLog): Promise<void> {
    await $api(`/api/cms/push/${log.id}`, { method: 'DELETE' });
    pushes.value = pushes.value.filter((item) => item.id !== log.id);
  }

  /// Lanza el envío de un borrador ya guardado.
  async function sendPush(log: PushLog): Promise<void> {
    const sent = await $api<PushLog>(`/api/cms/push/${log.id}/send`, {
      method: 'POST',
    });
    Object.assign(log, sent);
  }

  async function createAd(draft: AdDraft): Promise<SponsorAd> {
    const ad = await $api<SponsorAd>('/api/cms/ads', {
      method: 'POST',
      body: draft,
    });
    ads.value.unshift(ad);
    return ad;
  }

  async function updateAdStatus(
    ad: SponsorAd,
    status: SponsorAd['status'],
    overrideReason?: string,
  ): Promise<void> {
    const updated = await $api<SponsorAd>(`/api/cms/ads/${ad.id}`, {
      method: 'PUT',
      body: { status, overrideReason },
    });
    Object.assign(ad, updated);
  }

  async function updateAd(
    ad: SponsorAd,
    draft: Partial<AdDraft> & {
      status?: SponsorAd['status'];
      overrideReason?: string;
    },
  ): Promise<void> {
    const updated = await $api<SponsorAd>(`/api/cms/ads/${ad.id}`, {
      method: 'PUT',
      body: draft,
    });
    Object.assign(ad, updated);
  }

  async function deleteAd(ad: SponsorAd, reason?: string): Promise<void> {
    await $api(`/api/cms/ads/${ad.id}`, {
      method: 'DELETE',
      body: reason ? { reason } : undefined,
    });
    ads.value = ads.value.filter((item) => item.id !== ad.id);
  }

  /// Órdenes self-serve — el negocio pagó y espera aprobación.
  async function loadOrders(): Promise<void> {
    orders.value = await $api<AdOrder[]>('/api/ads/orders');
  }

  /// Aprobar = el anuncio pasa a ACTIVE y la vigencia arranca hoy.
  async function approveOrder(order: AdOrder): Promise<void> {
    const updated = await $api<AdOrder>(
      `/api/ads/orders/${order.id}/approve`,
      { method: 'POST' },
    );
    Object.assign(order, updated);
    if (order.sponsorAdId) {
      const ad = ads.value.find((a) => a.id === order.sponsorAdId);
      if (ad) ad.status = 'ACTIVE';
    }
  }

  /// Rechazar = reembolso Stripe automático + se borra el anuncio.
  async function rejectOrder(order: AdOrder, reason: string): Promise<void> {
    const updated = await $api<AdOrder>(
      `/api/ads/orders/${order.id}/reject`,
      { method: 'POST', body: { reason } },
    );
    Object.assign(order, updated);
    ads.value = ads.value.filter((a) => a.id !== order.sponsorAdId);
  }

  /// Precios de venta directa — /config/ads (solo admin).
  async function loadAdsConfig(): Promise<void> {
    adsConfig.value = await $api<AdSelfServeConfig>('/api/ads/self-serve');
  }

  async function saveAdsConfig(draft: AdSelfServeConfig): Promise<void> {
    adsConfig.value = await $api<AdSelfServeConfig>('/api/ads/self-serve', {
      method: 'PUT',
      body: draft,
    });
  }

  return {
    promos,
    coupons,
    pushes,
    ads,
    orders,
    adsConfig,
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
    loadOrders,
    approveOrder,
    rejectOrder,
    loadAdsConfig,
    saveAdsConfig,
  };
}
