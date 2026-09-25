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

  /// Socios creados en recepción y reclamados desde la app: su doc id
  /// NO es el auth uid — se busca por el campo auth_uid (mismo criterio
  /// que isSelfDoc en las reglas).
  const [directSnap, planSnap] = await Promise.all([
    db().collection('users').doc(uid).get(),
    db().collection('plans').doc(planId).get(),
  ]);
  let memberSnap = directSnap;
  if (!memberSnap.exists) {
    const byAuth = await db()
      .collection('users')
      .where('auth_uid', '==', uid)
      .limit(1)
      .get();
    memberSnap = byAuth.docs[0] ?? memberSnap;
  }
  if (!memberSnap.exists) {
    throw createError({ statusCode: 404, message: 'Socio no encontrado' });
  }
  const memberId = memberSnap.id;
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
      metadata: { member_id: memberId },
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
    /// member_id = doc id de /users (el webhook lo usa para
    /// actualizar la membresía), no el auth uid.
    metadata: { member_id: memberId, plan_id: planId },
  });

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
});
