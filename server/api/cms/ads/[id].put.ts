import { Timestamp } from 'firebase-admin/firestore';

import type { AdPaymentDraft, SponsorAd } from '#shared/types';
import { PLACEMENT_RANK } from '#shared/types';


import { writeAdAudit } from '../../../utils/audit';
import { db, toSponsorAd } from '../../../utils/db';
import { requireAdmin, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<SponsorAd> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('sponsorAds').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }
  const before = snap.data() ?? {};
  /// Anuncio comprado por self-serve — su espacio/visibilidad es lo que
  /// el anunciante PAGÓ; degradarlo requiere razón + evidencia en auditLogs.
  const orderId = (before.order_id as string | null) ?? null;
  const beforePlacement: SponsorAd['placement'] =
    before.placement === 'list' ? 'list' : 'carousel';

  const body = await readBody<Record<string, unknown>>(event) ?? {};
  const overrideReason =
    typeof body.overrideReason === 'string'
      ? body.overrideReason.trim().slice(0, 300)
      : '';
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
  if (body.placement === 'carousel' || body.placement === 'list') update.placement = body.placement;
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
      other_label: String(s.other_label ?? '').slice(0, 60),
      other_url: String(s.other_url ?? '').slice(0, 200),
    };
  }
  if (body.photos !== undefined) {
    update.photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string').slice(0, 1)
      : [];
  }

  const audits: Parameters<typeof writeAdAudit>[0][] = [];

  /// Control estricto de anuncios vencidos o extensiones de vigencia:
  /// Reactivar un vencido o extender la fecha manualmente NO puede ser
  /// silencioso. Requiere registrar cobro en recepción/admin o justificación
  /// obligatoria para auditoría.
  const beforeEndsAtMs = before.ends_at?.toMillis?.() ?? 0;
  const wasExpired =
    before.status === 'EXPIRED' ||
    (beforeEndsAtMs > 0 && beforeEndsAtMs <= Date.now());

  const targetEndsAtMs =
    typeof body.endsAt === 'number' && body.endsAt > 0
      ? body.endsAt
      : beforeEndsAtMs;

  const isReactivating =
    wasExpired &&
    (update.status === 'ACTIVE' ||
      (typeof body.endsAt === 'number' && body.endsAt > beforeEndsAtMs));

  const isExtending =
    !wasExpired &&
    typeof body.endsAt === 'number' &&
    body.endsAt > beforeEndsAtMs;

  if (isReactivating || isExtending) {
    if (isReactivating && targetEndsAtMs <= Date.now()) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'No puedes reactivar un anuncio vencido sin definir una nueva fecha de vigencia futura.',
      });
    }

    const rawPayment = body.payment as Record<string, unknown> | undefined;
    const payment: AdPaymentDraft | null =
      rawPayment && typeof rawPayment.amount === 'number' && rawPayment.amount > 0
        ? {
            amount: Math.round(rawPayment.amount),
            method: (['cash', 'terminal', 'transfer', 'card'].includes(String(rawPayment.method))
              ? String(rawPayment.method)
              : 'cash') as AdPaymentDraft['method'],
            folio: typeof rawPayment.folio === 'string' ? rawPayment.folio.trim().slice(0, 80) : '',
            notes: typeof rawPayment.notes === 'string' ? rawPayment.notes.trim().slice(0, 200) : '',
          }
        : null;

    if (!payment && overrideReason.length < 5) {
      throw createError({
        statusCode: 400,
        statusMessage: isReactivating
          ? 'Reactivar un anuncio vencido requiere registrar el cobro (en recepción o admin) o una justificación obligatoria de cortesía/extensión (mínimo 5 caracteres).'
          : 'Extender la vigencia de un anuncio requiere registrar el cobro o una justificación obligatoria de cortesía/extensión (mínimo 5 caracteres).',
      });
    }

    update.ends_at = Timestamp.fromMillis(targetEndsAtMs);
    if (isReactivating) {
      update.status = 'ACTIVE';
    }
    update.last_renewed_at = Timestamp.now();
    update.last_renewed_by = staff.email;

    if (payment) {
      update.last_renewed_amount = payment.amount;
      update.last_renewed_method = payment.method;
      update.last_courtesy_reason = null;

      const orderRef = db().collection('adOrders').doc();
      const diffMs = isReactivating
        ? targetEndsAtMs - Date.now()
        : targetEndsAtMs - beforeEndsAtMs;
      const weeks = Math.max(1, Math.round(diffMs / (7 * 86_400_000)));

      await orderRef.set({
        business_name: String(before.advertiser ?? ''),
        contact_name: String(before.advertiser ?? ''),
        email: '',
        phone: String(before.phone ?? ''),
        title: String(before.title ?? ''),
        subtitle: String(before.subtitle ?? ''),
        badge: String(before.badge ?? 'ALIADO'),
        brand_color: before.brand_color ?? null,
        image_url: String(before.image_url ?? ''),
        cta_label: String(before.cta_label ?? 'Ver oferta'),
        description: String(before.description ?? ''),
        address: String(before.address ?? ''),
        lat: before.lat ?? null,
        lng: before.lng ?? null,
        socials: before.socials ?? {},
        photos: before.photos ?? [],
        branch_id: before.branch_id ?? null,
        placement: update.placement ?? before.placement ?? 'carousel',
        weeks,
        amount: payment.amount,
        currency: 'mxn',
        status: 'APPROVED',
        payment_method: payment.method,
        payment_folio: payment.folio || null,
        sponsor_ad_id: id,
        created_at: Timestamp.now(),
        approved_at: Timestamp.now(),
        approved_by: staff.email,
        notes:
          payment.notes ||
          (isReactivating
            ? 'Reactivación de anuncio vencido en recepción / admin'
            : 'Extensión manual de vigencia en recepción / admin'),
      });
      update.order_id = orderRef.id;

      audits.push({
        adId: id,
        orderId: orderRef.id,
        advertiser: String(before.advertiser ?? ''),
        action: isReactivating ? 'REACTIVATE_EXPIRED' : 'PLACEMENT_UPGRADE',
        staff,
        reason: payment.folio
          ? `Cobro registrado: $${payment.amount} MXN (${payment.method}) · Ref: ${payment.folio}`
          : `Cobro registrado: $${payment.amount} MXN (${payment.method})`,
        changes: {
          status: {
            before: before.status ?? (wasExpired ? 'EXPIRED' : 'ACTIVE'),
            after: update.status ?? before.status,
          },
          ends_at: { before: beforeEndsAtMs, after: targetEndsAtMs },
        },
        payment,
      });
    } else {
      update.last_courtesy_reason = overrideReason;
      update.last_renewed_amount = 0;

      audits.push({
        adId: id,
        orderId,
        advertiser: String(before.advertiser ?? ''),
        action: isReactivating ? 'REACTIVATE_EXPIRED' : 'PLACEMENT_UPGRADE',
        staff,
        reason: isReactivating
          ? `Cortesía autorizada: ${overrideReason}`
          : `Extensión de cortesía: ${overrideReason}`,
        changes: {
          status: {
            before: before.status ?? (wasExpired ? 'EXPIRED' : 'ACTIVE'),
            after: update.status ?? before.status,
          },
          ends_at: { before: beforeEndsAtMs, after: targetEndsAtMs },
        },
        payment: null,
      });
    }
  }
  if (orderId) {
    const afterPlacement = update.placement as
      | SponsorAd['placement']
      | undefined;
    if (afterPlacement && afterPlacement !== beforePlacement) {
      const down =
        PLACEMENT_RANK[afterPlacement] < PLACEMENT_RANK[beforePlacement];
      if (down && !overrideReason) {
        throw createError({
          statusCode: 400,
          statusMessage:
            'Este anuncio fue comprado — bajar de espacio requiere una razón (queda en el log)',
        });
      }
      audits.push({
        adId: id,
        orderId,
        advertiser: String(before.advertiser ?? ''),
        action: down ? 'PLACEMENT_DOWNGRADE' : 'PLACEMENT_UPGRADE',
        staff,
        reason: overrideReason,
        changes: {
          placement: { before: beforePlacement, after: afterPlacement },
        },
      });
    }
    if (update.status === 'PAUSED' && before.status === 'ACTIVE') {
      if (!overrideReason) {
        throw createError({
          statusCode: 400,
          statusMessage:
            'Este anuncio fue comprado — pausarlo requiere una razón (queda en el log)',
        });
      }
      audits.push({
        adId: id,
        orderId,
        advertiser: String(before.advertiser ?? ''),
        action: 'PAUSE',
        staff,
        reason: overrideReason,
        changes: { status: { before: 'ACTIVE', after: 'PAUSED' } },
      });
    }
    /// Un PENDING se activa solo por el flujo de aprobación (define
    /// ends_at + marca la orden) — no por edición manual de status.
    if (update.status === 'ACTIVE' && before.status === 'PENDING') {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Los anuncios comprados se activan aprobando su orden en /publicidad',
      });
    }
  }

  if (Object.keys(update).length > 0) await ref.update(update);
  for (const audit of audits) await writeAdAudit(audit);
  return toSponsorAd(await ref.get());
});
