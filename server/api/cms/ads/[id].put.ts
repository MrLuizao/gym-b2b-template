import { Timestamp } from 'firebase-admin/firestore';

import type { SponsorAd } from '#shared/types';

import { db, toSponsorAd } from '../../../utils/db';
import { requireAdmin, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<SponsorAd> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('sponsorAds').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }

  const body = await readBody<Record<string, unknown>>(event) ?? {};
  const update: Record<string, unknown> = {};

  if (body.status === 'ACTIVE' || body.status === 'PAUSED') update.status = body.status;
  if (typeof body.advertiser === 'string' && body.advertiser.trim()) update.advertiser = body.advertiser.trim().slice(0, 60);
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim().slice(0, 80);
  if (typeof body.subtitle === 'string') update.subtitle = body.subtitle.trim().slice(0, 140);
  if (typeof body.badge === 'string') update.badge = body.badge.trim().slice(0, 12) || 'ALIADO';
  if (body.brandColor !== undefined) update.brand_color = typeof body.brandColor === 'number' ? body.brandColor : null;
  if (typeof body.imageUrl === 'string') update.image_url = body.imageUrl.trim();
  if (typeof body.ctaLabel === 'string') update.cta_label = body.ctaLabel.trim().slice(0, 24) || 'Ver más';
  if (body.branchId !== undefined) update.branch_id = body.branchId || null;
  if (typeof body.endsAt === 'number' && body.endsAt > 0) update.ends_at = Timestamp.fromMillis(body.endsAt);
  if (typeof body.description === 'string') update.description = body.description.trim().slice(0, 500);
  if (typeof body.address === 'string') update.address = body.address.trim().slice(0, 160);
  if (body.lat !== undefined) update.lat = typeof body.lat === 'number' ? body.lat : null;
  if (body.lng !== undefined) update.lng = typeof body.lng === 'number' ? body.lng : null;
  if (typeof body.phone === 'string') update.phone = body.phone.trim().slice(0, 30);
  if (body.socials !== undefined && typeof body.socials === 'object') {
    const s = body.socials as Record<string, unknown>;
    update.socials = {
      instagram: String(s.instagram ?? '').slice(0, 200),
      facebook: String(s.facebook ?? '').slice(0, 200),
      tiktok: String(s.tiktok ?? '').slice(0, 200),
      website: String(s.website ?? '').slice(0, 200),
      whatsapp: String(s.whatsapp ?? '').slice(0, 30),
    };
  }
  if (body.photos !== undefined) {
    update.photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string').slice(0, 8)
      : [];
  }

  if (Object.keys(update).length > 0) await ref.update(update);
  return toSponsorAd(await ref.get());
});
