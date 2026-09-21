import type { SponsorAd } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler(async (event): Promise<SponsorAd> => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const ad = db.ads.find((item) => item.id === id);
  if (!ad) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }

  const body = await readBody<{
    advertiser?: string;
    title?: string;
    subtitle?: string;
    badge?: string;
    imageUrl?: string;
    ctaLabel?: string;
    branchId?: string | null;
    endsAt?: number;
    status?: SponsorAd['status'];
    description?: string;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    phone?: string;
    socials?: Partial<SponsorAd['socials']>;
    photos?: string[];
  }>(event);

  if (body?.status === 'ACTIVE' || body?.status === 'PAUSED') {
    ad.status = body.status;
  }
  if (body?.advertiser !== undefined && body.advertiser.trim()) {
    ad.advertiser = body.advertiser.trim().slice(0, 60);
  }
  if (body?.title !== undefined && body.title.trim()) {
    ad.title = body.title.trim().slice(0, 80);
  }
  if (body?.subtitle !== undefined) ad.subtitle = body.subtitle.trim().slice(0, 140);
  if (body?.badge !== undefined) ad.badge = body.badge.trim().slice(0, 12) || 'ALIADO';
  if (body?.imageUrl !== undefined) ad.imageUrl = body.imageUrl.trim();
  if (body?.ctaLabel !== undefined) ad.ctaLabel = body.ctaLabel.trim().slice(0, 24) || 'Ver más';
  if (body?.branchId !== undefined) ad.branchId = body.branchId || null;
  if (typeof body?.endsAt === 'number' && body.endsAt > 0) {
    ad.endsAt = body.endsAt;
  }
  if (body?.description !== undefined)
    ad.description = body.description.trim().slice(0, 500);
  if (body?.address !== undefined)
    ad.address = body.address.trim().slice(0, 160);
  if (body?.lat !== undefined)
    ad.lat = typeof body.lat === 'number' ? body.lat : null;
  if (body?.lng !== undefined)
    ad.lng = typeof body.lng === 'number' ? body.lng : null;
  if (body?.phone !== undefined) ad.phone = body.phone.trim().slice(0, 30);
  if (body?.socials !== undefined) {
    ad.socials = {
      instagram: String(body.socials.instagram ?? '').slice(0, 200),
      facebook: String(body.socials.facebook ?? '').slice(0, 200),
      tiktok: String(body.socials.tiktok ?? '').slice(0, 200),
      website: String(body.socials.website ?? '').slice(0, 200),
      whatsapp: String(body.socials.whatsapp ?? '').slice(0, 30),
    };
  }
  if (body?.photos !== undefined) {
    ad.photos = Array.isArray(body.photos)
      ? body.photos.filter((p) => typeof p === 'string').slice(0, 8)
      : [];
  }
  return ad;
});
