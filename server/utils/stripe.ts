import Stripe from 'stripe';

let cached: Stripe | null = null;

/// Stripe del negocio — solo para cobros con tarjeta originados en la app
/// del socio (PaymentIntent). El B2B en sí no cobra con Stripe.
/// Env: STRIPE_SECRET_KEY.
export function useStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw createError({
      statusCode: 503,
      message: 'Stripe no configurado (STRIPE_SECRET_KEY)',
    });
  }
  cached ??= new Stripe(key);
  return cached;
}
