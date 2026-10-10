import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';

import { db, toAdSelfServeConfig } from '../../utils/db';
import { geocodeAddress } from '../../utils/geo';
import { useAdmin } from '../../utils/firebase-admin';
import {
  sendAdOrderPaidEmail,
  sendAdOrderStaffNotice,
} from '../../utils/mail';
import { useStripe } from '../../utils/stripe';

const MEMBERSHIP_PERIOD_DAYS = 30;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

/// La membresía se extiende +30d desde max(hoy, vencimiento vigente).
function extendedUntil(member: FirebaseFirestore.DocumentData): Timestamp {
  const current =
    (member.membership_until as Timestamp | null)?.toMillis() ?? 0;
  const base = Math.max(Date.now(), current);
  return Timestamp.fromMillis(base + MEMBERSHIP_PERIOD_DAYS * 86_400_000);
}

async function applyApprovedPayment(opts: {
  memberId: string;
  planId: string;
  amountCentavos: number;
  paymentIntentId: string;
  chargeId: string | null;
  receiptUrl: string | null;
}): Promise<void> {
  const [memberSnap, planSnap] = await Promise.all([
    db().collection('users').doc(opts.memberId).get(),
    db().collection('plans').doc(opts.planId).get(),
  ]);
  const member = memberSnap.data() ?? {};
  const plan = planSnap.data() ?? {};

  const batch = db().batch();
  batch.set(db().collection('payments').doc(), {
    member_id: opts.memberId,
    member_name: member.name ?? '',
    member_number: member.member_number ?? '',
    branch_id: member.branch_id ?? null,
    plan_id: opts.planId,
    plan: plan.name ?? '',
    amount: Math.round(opts.amountCentavos) / 100,
    currency: 'mxn',
    provider: 'stripe',
    method: 'card',
    transaction_id: null,
    stripe_payment_intent_id: opts.paymentIntentId,
    stripe_charge_id: opts.chargeId,
    receipt_url: opts.receiptUrl,
    status: 'APPROVED',
    failure_reason: null,
    created_at: FieldValue.serverTimestamp(),
    created_by: 'member_app',
    created_by_uid: null,
  });
  batch.update(db().collection('users').doc(opts.memberId), {
    membership_plan_id: opts.planId,
    membership_status: 'ACTIVE',
    membership_until: extendedUntil(member),
  });
  await batch.commit();
}

/// Orden self-serve pagada → crea el sponsorAds con status PENDING
/// (invisible en la app — el socio solo ve ACTIVE) y notifica al staff
/// para que apruebe o reembolse. Guardada por status de la orden —
/// puede dispararse desde checkout.session.completed o
/// payment_intent.succeeded sin duplicar.
async function fulfillAdOrder(opts: {
  orderId: string;
  paymentIntentId: string | null;
  origin: string;
}): Promise<void> {
  const orderRef = db().collection('adOrders').doc(opts.orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return;
  const order = orderSnap.data()!;
  if (order.status !== 'AWAITING_PAYMENT') return;

  /// Coordenadas: el pin que el anunciante confirmó en el mapa gana;
  /// si no lo movió, geocodificamos su dirección como respaldo. Si
  /// nada resuelve, el admin las fija a mano en el detalle.
  const coords =
    typeof order.lat === 'number' && typeof order.lng === 'number'
      ? { lat: order.lat, lng: order.lng }
      : await geocodeAddress(String(order.address ?? ''));

  const adRef = db().collection('sponsorAds').doc();
  const batch = db().batch();
  batch.set(adRef, {
    advertiser: order.business_name ?? '',
    title: order.title ?? '',
    subtitle: order.subtitle ?? '',
    badge: order.badge ?? 'ALIADO',
    brand_color: order.brand_color ?? null,
    image_url: order.image_url ?? '',
    cta_label: order.cta_label ?? 'Ver más',
    branch_id: order.branch_id ?? null,
    placement: order.placement === 'list' ? 'list' : 'carousel',
    /// PENDING hasta que el admin apruebe — la vigencia (ends_at)
    /// arranca en la aprobación, no en el pago.
    status: 'PENDING',
    ends_at: null,
    impressions: 0,
    taps: 0,
    created_at: Timestamp.now(),
    description: order.description ?? '',
    address: order.address ?? '',
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    phone: order.phone ?? '',
    socials: order.socials ?? {},
    photos: order.photos ?? [],
    order_id: orderRef.id,
  });
  batch.update(orderRef, {
    status: 'PENDING_APPROVAL',
    sponsor_ad_id: adRef.id,
    stripe_payment_intent_id: opts.paymentIntentId,
    paid_at: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  /// Notificaciones — nunca tumban el fulfillment (ya está persistido).
  try {
    const brandName =
      ((await db().collection('config').doc('brand').get()).data()
        ?.name as string | undefined) ?? 'el gimnasio';
    const placementLabel =
      order.placement === 'list'
        ? 'Directorio de Aliados'
        : 'Carrusel destacado + Aliados';
    const branchLabel = order.branch_id
      ? (((await db().collection('branches').doc(String(order.branch_id)).get()).data()
          ?.name as string | undefined) ?? 'Sede')
      : 'Todas las sedes';
    const [adminsSnap] = await Promise.all([
      db().collection('staff').where('role', '==', 'ADMIN').get(),
      sendAdOrderPaidEmail({
        to: String(order.email ?? ''),
        businessName: String(order.business_name ?? ''),
        brandName,
        amount: Number(order.amount ?? 0),
        weeks: Number(order.weeks ?? 1),
      }),
    ]);
    const reviewUrl = `${opts.origin}/publicidad/${adRef.id}`;
    const notified = new Set<string>();
    for (const doc of adminsSnap.docs) {
      if (doc.data().active === false) continue;
      try {
        const user = await useAdmin().auth.getUser(doc.id);
        if (user.email) {
          notified.add(user.email.toLowerCase());
          await sendAdOrderStaffNotice({
            to: user.email,
            businessName: String(order.business_name ?? ''),
            placementLabel,
            branchLabel,
            weeks: Number(order.weeks ?? 1),
            amount: Number(order.amount ?? 0),
            reviewUrl,
          });
        }
      } catch {
        /// Auth user sin email o borrado — se omite.
      }
    }
    /// Correos configurados en /config/ads (Venta directa → avisos):
    /// globales siempre; por sede solo si la orden compró esa sede —
    /// "todas las sedes" avisa a TODOS los correos por sede.
    const notify = toAdSelfServeConfig(
      await db().collection('config').doc('ads').get(),
    ).notify;
    const extra = new Set(notify.global);
    if (order.branch_id) {
      const branchEmail = notify.byBranch[String(order.branch_id)];
      if (branchEmail) extra.add(branchEmail);
    } else {
      for (const e of Object.values(notify.byBranch)) {
        if (e) extra.add(e);
      }
    }
    for (const to of extra) {
      if (notified.has(to.toLowerCase())) continue;
      try {
        await sendAdOrderStaffNotice({
          to,
          businessName: String(order.business_name ?? ''),
          placementLabel,
          branchLabel,
          weeks: Number(order.weeks ?? 1),
          amount: Number(order.amount ?? 0),
          reviewUrl,
        });
      } catch {
        /// Un destinatario que falle no bloquea a los demás.
      }
    }
  } catch (error) {
    console.warn('[webhook] aviso de orden de anuncio falló:', error);
  }
}

/// Webhook de Stripe — único escritor de cobros con tarjeta.
/// Idempotente: /webhookEvents/{eventId} evita reprocesar reintentos.
/// Configurar en Stripe Dashboard → Webhooks → endpoint
/// https://<dominio>/api/webhooks/stripe con secret STRIPE_WEBHOOK_SECRET.
export default defineEventHandler(async (event) => {
  const signature = getHeader(event, 'stripe-signature');
  if (!signature || !WEBHOOK_SECRET) {
    throw createError({ statusCode: 400, message: 'Firma faltante' });
  }

  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({ statusCode: 400, message: 'Body vacío' });
  }

  const stripe = useStripe();
  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      WEBHOOK_SECRET,
    );
  } catch {
    throw createError({ statusCode: 400, message: 'Firma inválida' });
  }

  /// Idempotencia — Stripe reintenta; si el eventId ya existe, ignoramos.
  const eventRef = db().collection('webhookEvents').doc(stripeEvent.id);
  try {
    await eventRef.create({
      type: stripeEvent.type,
      processed_at: FieldValue.serverTimestamp(),
    });
  } catch {
    return { received: true, duplicate: true };
  }

  try {
    if (stripeEvent.type === 'payment_intent.succeeded') {
      const intent = stripeEvent.data.object as Stripe.PaymentIntent;
      /// Cobros de órdenes de publicidad self-serve — el PI lleva
      /// ad_order_id (lo pone Checkout); sirve de respaldo si el
      /// dashboard no tiene suscrito checkout.session.completed.
      const adOrderId = intent.metadata?.ad_order_id;
      if (adOrderId) {
        await fulfillAdOrder({
          orderId: adOrderId,
          paymentIntentId: intent.id,
          origin: getRequestURL(event).origin,
        });
        return { received: true };
      }
      const memberId = intent.metadata?.member_id;
      const planId = intent.metadata?.plan_id;
      if (!memberId || !planId) {
        throw new Error('PaymentIntent sin metadata member_id/plan_id');
      }

      let chargeId: string | null = null;
      let receiptUrl: string | null = null;
      const latestCharge = intent.latest_charge;
      if (typeof latestCharge === 'string') {
        chargeId = latestCharge;
        const charge = await stripe.charges.retrieve(latestCharge);
        receiptUrl = charge.receipt_url ?? null;
      }

      await applyApprovedPayment({
        memberId,
        planId,
        amountCentavos: intent.amount_received,
        paymentIntentId: intent.id,
        chargeId,
        receiptUrl,
      });
    } else if (stripeEvent.type === 'payment_intent.payment_failed') {
      const intent = stripeEvent.data.object as Stripe.PaymentIntent;
      await db().collection('payments').add({
        member_id: intent.metadata?.member_id ?? '',
        member_name: '',
        member_number: '',
        branch_id: null,
        plan_id: intent.metadata?.plan_id ?? '',
        plan: '',
        amount: Math.round(intent.amount ?? 0) / 100,
        currency: 'mxn',
        provider: 'stripe',
        method: 'card',
        transaction_id: null,
        stripe_payment_intent_id: intent.id,
        stripe_charge_id: null,
        receipt_url: null,
        status: 'DECLINED',
        failure_reason:
          intent.last_payment_error?.message ?? 'payment_failed',
        created_at: FieldValue.serverTimestamp(),
        created_by: 'member_app',
        created_by_uid: null,
      });
    } else if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.ad_order_id;
      if (orderId && session.payment_status === 'paid') {
        await fulfillAdOrder({
          orderId,
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,
          origin: getRequestURL(event).origin,
        });
      }
    } else if (stripeEvent.type === 'checkout.session.expired') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.ad_order_id;
      if (orderId) {
        const orderRef = db().collection('adOrders').doc(orderId);
        const snap = await orderRef.get();
        if (snap.data()?.status === 'AWAITING_PAYMENT') {
          await orderRef.update({ status: 'EXPIRED' });
        }
      }
    } else if (stripeEvent.type === 'charge.refunded') {
      const charge = stripeEvent.data.object as Stripe.Charge;
      const existing = await db()
        .collection('payments')
        .where('stripe_charge_id', '==', charge.id)
        .limit(1)
        .get();
      if (!existing.empty) {
        await existing.docs[0]!.ref.update({ status: 'REFUNDED' });
      }
    }
  } catch (error) {
    /// El doc de webhookEvents ya existe — el retry no reprocesa.
    /// Dejar constancia del fallo para revisión manual.
    await eventRef.update({
      error: error instanceof Error ? error.message : String(error),
    });
    return { received: true, error: true };
  }

  return { received: true };
});
