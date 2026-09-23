import { db } from '../../utils/db';
import { requireUser } from '../../utils/staff-auth';
import { useStripe } from '../../utils/stripe';

/// Cobro con tarjeta desde la app del socio — crea el PaymentIntent.
/// El doc en /payments lo escribe el webhook al confirmarse el cobro.
export default defineEventHandler(async (event) => {
  const { uid, email } = await requireUser(event);
  const body = await readBody<{ planId?: string }>(event);
  const planId = body?.planId;
  if (typeof planId !== 'string' || !planId) {
    throw createError({ statusCode: 400, message: 'planId requerido' });
  }

  const [memberSnap, planSnap] = await Promise.all([
    db().collection('users').doc(uid).get(),
    db().collection('plans').doc(planId).get(),
  ]);
  if (!memberSnap.exists) {
    throw createError({ statusCode: 404, message: 'Socio no encontrado' });
  }
  if (!planSnap.exists || planSnap.data()?.active === false) {
    throw createError({ statusCode: 404, message: 'Plan no encontrado' });
  }

  const member = memberSnap.data() ?? {};
  const plan = planSnap.data() ?? {};
  const stripe = useStripe();

  let customerId = member.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: member.name as string | undefined,
      metadata: { member_id: uid },
    });
    customerId = customer.id;
    await memberSnap.ref.update({ stripe_customer_id: customerId });
  }

  const intent = await stripe.paymentIntents.create({
    /// Montos en pesos en Firestore; Stripe cobra en centavos.
    amount: Math.round(Number(plan.price ?? 0) * 100),
    currency: 'mxn',
    customer: customerId,
    payment_method_types: ['card'],
    metadata: { member_id: uid, plan_id: planId },
  });

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
});
