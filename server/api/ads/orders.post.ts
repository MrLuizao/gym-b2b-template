import { Timestamp } from 'firebase-admin/firestore';

import type { SponsorAd } from '#shared/types';

import { db, toAdSelfServeConfig } from '../../utils/db';
import { rateLimit } from '../../utils/rate-limit';
import { useStripe } from '../../utils/stripe';

/// Tope de campaña — 4 semanas para que el paquete de pushes semanales
/// (1/semana) siempre quepa dentro de la vigencia comprada.
const MAX_WEEKS = 4;
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
/// El monto se calcula AQUÍ (precio/semana × semanas) — el cliente
/// nunca dicta el precio.
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
    lat?: number | null;
    lng?: number | null;
    socials?: Partial<SponsorAd['socials']>;
    photos?: string[];
    placement?: string;
    weeks?: number;
    wantsPush?: boolean;
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

  const configSnap = await db().collection('config').doc('ads').get();
  const config = toAdSelfServeConfig(configSnap);
  if (!config.enabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'La venta directa de publicidad no está disponible',
    });
  }

  /// Solo dos productos: 'list' o 'carousel' (cualquier otra cosa,
  /// incluido el 'both' legacy, cae a carousel).
  const placement: SponsorAd['placement'] =
    String(body!.placement ?? '') === 'list' ? 'list' : 'carousel';
  const slot = config.slots[placement];
  if (!slot.enabled || slot.pricePerWeek <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ese espacio publicitario no está a la venta',
    });
  }

  /// Paquete de pushes — solo cuenta si la config lo ofrece con
  /// cantidad y precio >0. Toda compra ya incluye 1 push gratis.
  const wantsPush =
    body!.wantsPush === true &&
    config.push.enabled &&
    config.push.count > 0 &&
    config.push.price > 0;
  const pushPack = wantsPush ? config.push.count : 0;

  /// Coordenadas del pin que el anunciante movió en el mapa — vienen
  /// juntas o no vienen; si no vienen el webhook geocodifica.
  const rawLat = Number(body!.lat);
  const rawLng = Number(body!.lng);
  const coordsValid =
    Number.isFinite(rawLat) &&
    Number.isFinite(rawLng) &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLng >= -180 &&
    rawLng <= 180;
  const lat = coordsValid ? rawLat : null;
  const lng = coordsValid ? rawLng : null;

  /// Tarifa plana por semana — los anuncios siempre se muestran en
  /// todas las sedes (la segmentación por sede se eliminó). El push
  /// es cobro único adicional.
  const amount = slot.pricePerWeek * weeks + (wantsPush ? config.push.price : 0);

  const ref = db().collection('adOrders').doc();
  const origin = getRequestURL(event).origin;
  const stripe = useStripe();

  const slotLabel =
    placement === 'list' ? 'Directorio de Aliados' : 'Carrusel destacado';
  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: 'mxn',
        unit_amount: Math.round(slot.pricePerWeek * weeks * 100),
        product_data: {
          name: `Publicidad — ${slotLabel}`,
          description: `${weeks} semana(s) · todas las sedes · sujeto a aprobación del gym`,
        },
      },
    },
    ...(wantsPush
      ? [
          {
            quantity: 1,
            price_data: {
              currency: 'mxn',
              unit_amount: Math.round(config.push.price * 100),
              product_data: {
                name: `Paquete de ${pushPack} notificaciones push`,
                description:
                  'Una por semana a todos los socios (además del push incluido)',
              },
            },
          },
        ]
      : []),
  ];
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: cleanStr(body!.email, 120),
    line_items: lineItems,
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
    lat,
    lng,
    socials: {
      instagram: cleanStr(body!.socials?.instagram, 200),
      facebook: cleanStr(body!.socials?.facebook, 200),
      tiktok: cleanStr(body!.socials?.tiktok, 200),
      website: cleanStr(body!.socials?.website, 200),
      whatsapp: cleanStr(body!.socials?.whatsapp, 30),
      other_label: cleanStr(body!.socials?.other_label, 60),
      other_url: cleanStr(body!.socials?.other_url, 200),
    },
    photos,
    /// Los anuncios ya no se segmentan por sede — siempre null.
    branch_id: null,
    placement,
    weeks,
    amount,
    currency: 'mxn',
    status: 'AWAITING_PAYMENT',
    stripe_session_id: session.id,
    stripe_payment_intent_id: null,
    sponsor_ad_id: null,
    rejection_reason: null,
    wants_push: wantsPush,
    push_pack: pushPack,
    push_log_ids: [],
    push_sent_at: null,
    push_error: null,
    created_at: Timestamp.now(),
    paid_at: null,
    reviewed_at: null,
    reviewed_by: null,
    source: 'self_serve',
  });

  return { checkoutUrl: session.url, orderId: ref.id };
});
