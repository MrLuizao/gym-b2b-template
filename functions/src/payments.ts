import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

import {
  FieldValue,
  HttpsError,
  MemberDoc,
  db,
  extendedUntil,
  requireStaff,
} from './utils';

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

export function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

const ALLOWED_METHODS = new Set(['cash', 'transfer', 'terminal']);

/// Cobro en mostrador — recepción registra efectivo/transferencia/terminal.
/// provider: 'manual'. Sin Stripe de por medio.
export const registerManualPayment = onCall(async (request) => {
  const staff = await requireStaff(request);
  const data = (request.data ?? {}) as Record<string, unknown>;

  const memberId = data.memberId;
  const planId = data.planId;
  const method = data.method;
  if (typeof memberId !== 'string' || typeof planId !== 'string') {
    throw new HttpsError('invalid-argument', 'memberId y planId requeridos');
  }
  if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
    throw new HttpsError(
      'invalid-argument',
      `method debe ser: ${[...ALLOWED_METHODS].join(', ')}`,
    );
  }

  const [memberSnap, planSnap] = await Promise.all([
    db.collection('users').doc(memberId).get(),
    db.collection('plans').doc(planId).get(),
  ]);
  if (!memberSnap.exists) {
    throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
  }
  if (!planSnap.exists || planSnap.data()?.active === false) {
    throw new HttpsError('not-found', 'PLAN_NOT_FOUND');
  }

  const member = (memberSnap.data() ?? {}) as MemberDoc;
  const plan = planSnap.data() ?? {};
  const branchId = staff.branchId ?? (data.branchId as string) ?? null;
  if (!branchId) {
    throw new HttpsError('invalid-argument', 'branchId requerido para admin');
  }
  const pricePesos = Number(plan.price ?? 0);

  const paymentRef = db.collection('payments').doc();
  const batch = db.batch();
  batch.set(paymentRef, {
    member_id: memberId,
    member_name: member.name ?? '',
    member_number: member.member_number ?? '',
    branch_id: branchId,
    plan_id: planId,
    plan: (plan.name as string) ?? '',
    amount: pricePesos,
    currency: 'mxn',
    provider: 'manual',
    method,
    transaction_id:
      typeof data.transactionId === 'string' ? data.transactionId : null,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    receipt_url: null,
    status: 'APPROVED',
    failure_reason: null,
    created_at: FieldValue.serverTimestamp(),
    created_by: 'reception',
    created_by_uid: staff.uid,
  });
  batch.update(db.collection('users').doc(memberId), {
    membership_plan_id: planId,
    membership_status: 'ACTIVE',
    membership_until: extendedUntil(member),
  });
  await batch.commit();

  return { ok: true, paymentId: paymentRef.id };
});

/// Cobro con tarjeta desde la app del socio — Stripe PaymentIntent.
/// El doc en /payments lo crea el webhook al confirmarse el cobro.
export const createPaymentIntent = onCall(
  { secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sesión requerida');
    }
    const planId = (request.data ?? {}).planId;
    if (typeof planId !== 'string') {
      throw new HttpsError('invalid-argument', 'planId requerido');
    }

    const memberId = request.auth.uid;
    const [memberSnap, planSnap] = await Promise.all([
      db.collection('users').doc(memberId).get(),
      db.collection('plans').doc(planId).get(),
    ]);
    if (!memberSnap.exists) {
      throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
    }
    if (!planSnap.exists || planSnap.data()?.active === false) {
      throw new HttpsError('not-found', 'PLAN_NOT_FOUND');
    }

    const stripe = stripeClient();
    const member = (memberSnap.data() ?? {}) as MemberDoc & {
      stripe_customer_id?: string;
    };
    const plan = planSnap.data() ?? {};

    let customerId = member.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.auth.token.email,
        name: member.name,
        metadata: { member_id: memberId },
      });
      customerId = customer.id;
      await db
        .collection('users')
        .doc(memberId)
        .update({ stripe_customer_id: customerId });
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(plan.price ?? 0) * 100),
      currency: 'mxn',
      customer: customerId,
      payment_method_types: ['card'],
      metadata: { member_id: memberId, plan_id: planId },
    });

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    };
  },
);

/// Aplica un cobro aprobado a la membresía del socio.
/// Compartido por webhook Stripe y cualquier otro origen.
export async function applyApprovedPayment(opts: {
  memberId: string;
  planId: string;
  amountCentavos: number;
  paymentIntentId: string;
  chargeId: string | null;
  receiptUrl: string | null;
}): Promise<void> {
  const [memberSnap, planSnap] = await Promise.all([
    db.collection('users').doc(opts.memberId).get(),
    db.collection('plans').doc(opts.planId).get(),
  ]);
  const member = (memberSnap.data() ?? {}) as MemberDoc;
  const plan = planSnap.data() ?? {};

  const batch = db.batch();
  batch.set(db.collection('payments').doc(), {
    member_id: opts.memberId,
    member_name: member.name ?? '',
    member_number: member.member_number ?? '',
    branch_id: (member as { branch_id?: string }).branch_id ?? null,
    plan_id: opts.planId,
    plan: (plan.name as string) ?? '',
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
  });
  batch.update(db.collection('users').doc(opts.memberId), {
    membership_plan_id: opts.planId,
    membership_status: 'ACTIVE',
    membership_until: extendedUntil(member),
  });
  await batch.commit();
}
