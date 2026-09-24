import { Timestamp } from 'firebase-admin/firestore';

import type { SponsorAd } from '#shared/types';

import { db, toSponsorAd } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<SponsorAd> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<{
    advertiser?: string;
    title?: string;
    subtitle?: string;
    badge?: string;
    brandColor?: number | null;
    imageUrl?: string;
    ctaLabel?: string;
    branchId?: string | null;
    placement?: SponsorAd['placement'];
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

  const missing: string[] = [];
  if (!body?.advertiser?.trim()) missing.push('anunciante');
  if (!body?.title?.trim()) missing.push('título');
  if (!body?.subtitle?.trim()) missing.push('subtítulo');
  if (!body?.badge?.trim()) missing.push('badge');
  if (!body?.imageUrl?.trim()) missing.push('imagen');
  if (!body?.ctaLabel?.trim()) missing.push('botón (CTA)');
  if (typeof body?.endsAt !== 'number' || body.endsAt <= 0) missing.push('vigencia');
  if (!body?.description?.trim()) missing.push('descripción');
  if (!body?.address?.trim()) missing.push('dirección');
  if (!body?.phone?.trim()) missing.push('teléfono');
  if (typeof body?.lat !== 'number') missing.push('latitud');
  if (typeof body?.lng !== 'number') missing.push('longitud');
  if (!Array.isArray(body?.photos) || body.photos.length === 0) missing.push('portada');
  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Todos los campos son obligatorios — falta: ${missing.join(', ')}`,
    });
  }

  const ref = db().collection('sponsorAds').doc();
  await ref.set({
    advertiser: String(body!.advertiser).slice(0, 60),
    title: String(body!.title).slice(0, 80),
    subtitle: String(body!.subtitle ?? '').slice(0, 140),
    badge: String(body!.badge ?? 'ALIADO').slice(0, 12),
    brand_color:
      typeof body!.brandColor === 'number' && Number.isFinite(body!.brandColor)
        ? body!.brandColor
        : null,
    image_url: String(body!.imageUrl),
    cta_label: String(body!.ctaLabel ?? 'Ver más').slice(0, 24),
    branch_id: body!.branchId || null,
    placement: body!.placement === 'list' ? 'list' : 'carousel',
    status: body!.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    ends_at: Timestamp.fromMillis(Number(body!.endsAt)),
    impressions: 0,
    taps: 0,
    created_at: Timestamp.now(),
    description: String(body!.description ?? '').slice(0, 500),
    address: String(body!.address ?? '').slice(0, 160),
    lat: typeof body!.lat === 'number' ? body!.lat : null,
    lng: typeof body!.lng === 'number' ? body!.lng : null,
    phone: String(body!.phone ?? '').slice(0, 30),
    socials: {
      instagram: String(body!.socials?.instagram ?? '').slice(0, 200),
      facebook: String(body!.socials?.facebook ?? '').slice(0, 200),
      tiktok: String(body!.socials?.tiktok ?? '').slice(0, 200),
      website: String(body!.socials?.website ?? '').slice(0, 200),
      whatsapp: String(body!.socials?.whatsapp ?? '').slice(0, 30),
    },
    photos: Array.isArray(body!.photos)
      ? body!.photos.filter((p) => typeof p === 'string').slice(0, 1)
      : [],
  });
  return toSponsorAd(await ref.get());
});
