import { Timestamp } from 'firebase-admin/firestore';

import type { SponsorAd } from '#shared/types';

import { db, toAdSelfServeConfig } from '../../utils/db';
import { rateLimit } from '../../utils/rate-limit';
import { useStripe } from '../../utils/stripe';

const MAX_WEEKS = 12;
/// Tope del creativo — mismo límite práctico que el ImagePicker deja
/// pasar al comprimir (una imagen ~300 KB + una portada).
const MAX_IMAGE_CHARS = 400_000;
const MAX_TOTAL_IMAGE_CHARS = 900_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/// Público — compra self-serve de publicidad. El negocio sube su
/// creativo y paga por Stripe Checkout; el webhook convierte la orden
/// en sponsorAds PENDING para que el gym la apruebe o reembolse.
/// El monto se calcula AQUÍ (precio/semana × semanas × sedes) — el
/// cliente nunca dicta el precio.
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'anon';
  await rateLimit(`ads-order:${ip}`, 5, 10 * 60_000);

  const body = await readBody<{
    businessName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    title?: string;
    subtitle?: string;
    badge?: string;
    brandColor?: number | null;
    imageUrl?: string;
    ctaLabel?: string;
    description?: string;
    address?: string;
    socials?: Partial<SponsorAd['socials']>;
    photos?: string[];
    branchId?: string | null;
    placement?: string;
    weeks?: number;
    /// Honeypot — los bots lo llenan, los humanos no lo ven.
    company?: string;
  }>(event);

  /// Trampa anti-bot: respuesta exitosa falsa, sin crear nada.
  if (body?.company) {
    return { checkoutUrl: null };
  }

  const missing: string[] = [];
  if (!cleanStr(body?.businessName, 80)) missing.push('negocio');
  if (!cleanStr(body?.contactName, 80)) missing.push('contacto');
  if (!EMAIL_RE.test(cleanStr(body?.email, 120))) missing.push('email válido');
  if (!cleanStr(body?.phone, 30)) missing.push('teléfono');
  if (!cleanStr(body?.title, 80)) missing.push('título del anuncio');
  if (!cleanStr(body?.subtitle, 140)) missing.push('subtítulo');
  if (!cleanStr(body?.ctaLabel, 24)) missing.push('botón (CTA)');
  const imageUrl = cleanStr(body?.imageUrl, MAX_IMAGE_CHARS + 512);
  if (!imageUrl.startsWith('data:image/')) missing.push('imagen');
  const photos = Array.isArray(body?.photos)
    ? body.photos
        .filter(
          (p): p is string =>
            typeof p === 'string' && p.startsWith('data:image/'),
        )
        .map((p) => p.slice(0, MAX_IMAGE_CHARS + 512))
        .slice(0, 1)
    : [];
  if (imageUrl.length + photos.reduce((s, p) => s + p.length, 0) > MAX_TOTAL_IMAGE_CHARS) {
    missing.push('imágenes más ligeras');
  }
  const weeks = Math.floor(Number(body?.weeks ?? 0));
  if (!Number.isFinite(weeks) || weeks < 1 || weeks > MAX_WEEKS) {
    missing.push(`duración (1-${MAX_WEEKS} semanas)`);
  }
  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Revisa el formulario — falta o es inválido: ${missing.join(', ')}`,
    });
  }

  const [configSnap, branchesSnap] = await Promise.all([
    db().collection('config').doc('ads').get(),
    db().collection('branches').get(),
  ]);
  const config = toAdSelfServeConfig(configSnap);
  if (!config.enabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'La venta directa de publicidad no está disponible',
    });
  }

  const raw = String(body!.placement ?? '');
  const placement: SponsorAd['placement'] =
    raw === 'list' || raw === 'both' ? raw : 'carousel';
  const slot = config.slots[placement];
  if (!slot.enabled || slot.pricePerWeek <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ese espacio publicitario no está a la venta',
    });
  }

  const branchIds = branchesSnap.docs.map((d) => d.id);
  const branchId = body!.branchId ? String(body!.branchId) : null;
  if (branchId && !branchIds.includes(branchId)) {
    throw createError({ statusCode: 400, statusMessage: 'Sede inválida' });
  }

  /// Precio por sede: una sede = tarifa base, todas = tarifa × N sedes.
  const scopeFactor = branchId ? 1 : Math.max(1, branchIds.length);
  const amount = slot.pricePerWeek * weeks * scopeFactor;

  const ref = db().collection('adOrders').doc();
  const origin = getRequestURL(event).origin;
  const stripe = useStripe();

  const slotLabel =
    placement === 'both'
      ? 'Carrusel del Home + Directorio de Aliados'
      : placement === 'list'
        ? 'Directorio de Aliados'
        : 'Carrusel del Home';
  const scopeLabel = branchId ? '1 sede' : 'todas las sedes';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: cleanStr(body!.email, 120),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'mxn',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Publicidad — ${slotLabel}`,
            description: `${weeks} semana(s) · ${scopeLabel} · sujeto a aprobación del gym`,
          },
        },
      },
    ],
    metadata: { ad_order_id: ref.id },
    payment_intent_data: { metadata: { ad_order_id: ref.id } },
    success_url: `${origin}/anuncia/exito?order=${ref.id}`,
    cancel_url: `${origin}/anuncia?cancelado=1`,
  });

  await ref.set({
    business_name: cleanStr(body!.businessName, 80),
    contact_name: cleanStr(body!.contactName, 80),
    email: cleanStr(body!.email, 120),
    phone: cleanStr(body!.phone, 30),
    title: cleanStr(body!.title, 80),
    subtitle: cleanStr(body!.subtitle, 140),
    badge: cleanStr(body!.badge, 12) || 'ALIADO',
    brand_color:
      typeof body!.brandColor === 'number' && Number.isFinite(body!.brandColor)
        ? body!.brandColor
        : null,
    image_url: imageUrl,
    cta_label: cleanStr(body!.ctaLabel, 24) || 'Ver más',
    description: cleanStr(body!.description, 500),
    address: cleanStr(body!.address, 160),
    socials: {
      instagram: cleanStr(body!.socials?.instagram, 200),
      facebook: cleanStr(body!.socials?.facebook, 200),
      tiktok: cleanStr(body!.socials?.tiktok, 200),
      website: cleanStr(body!.socials?.website, 200),
      whatsapp: cleanStr(body!.socials?.whatsapp, 30),
    },
    photos,
    branch_id: branchId,
    placement,
    weeks,
    amount,
    currency: 'mxn',
    status: 'AWAITING_PAYMENT',
    stripe_session_id: session.id,
    stripe_payment_intent_id: null,
    sponsor_ad_id: null,
    rejection_reason: null,
    created_at: Timestamp.now(),
    paid_at: null,
    reviewed_at: null,
    reviewed_by: null,
    source: 'self_serve',
  });

  return { checkoutUrl: session.url, orderId: ref.id };
});
