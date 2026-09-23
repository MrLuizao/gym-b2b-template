import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';

import { db } from '../../utils/db';
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
