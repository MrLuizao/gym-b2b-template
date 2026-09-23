import { FieldValue } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

import { applyApprovedPayment, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, stripeClient } from './payments';
import { db } from './utils';

/// Webhook de Stripe — único escritor de cobros con tarjeta.
/// Idempotente: /webhookEvents/{eventId} evita reprocesar reintentos.
export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      res.status(400).send('Missing stripe-signature');
      return;
    }

    const stripe = stripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET.value(),
      );
    } catch {
      res.status(400).send('Invalid signature');
      return;
    }

    /// Idempotencia — Stripe reintenta; si el eventId ya existe, ignoramos.
    const eventRef = db.collection('webhookEvents').doc(event.id);
    try {
      await eventRef.create({
        type: event.type,
        processed_at: FieldValue.serverTimestamp(),
      });
    } catch {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object as Stripe.PaymentIntent;
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
      } else if (event.type === 'payment_intent.payment_failed') {
        const intent = event.data.object as Stripe.PaymentIntent;
        await db.collection('payments').add({
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
        });
      } else if (event.type === 'charge.refunded') {
        const charge = event.data.object as Stripe.Charge;
        const existing = await db
          .collection('payments')
          .where('stripe_charge_id', '==', charge.id)
          .limit(1)
          .get();
        if (!existing.empty) {
          await existing.docs[0]!.ref.update({ status: 'REFUNDED' });
        }
      }
    } catch (error) {
      /// El doc de webhookEvents ya existe — el retry de Stripe no
      /// reprocesa. Dejar constancia del fallo para revisión manual.
      await eventRef.update({
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ received: true, error: true });
      return;
    }

    res.status(200).json({ received: true });
  },
);
