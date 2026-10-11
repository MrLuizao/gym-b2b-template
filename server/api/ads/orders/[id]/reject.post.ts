import { FieldValue } from 'firebase-admin/firestore';

import type { AdOrder } from '#shared/types';

import { db, toAdOrder } from '../../../../utils/db';
import { sendAdOrderRejectedEmail } from '../../../../utils/mail';
import { requireBranchScope, requireStaff } from '../../../../utils/staff-auth';
import { useStripe } from '../../../../utils/stripe';

/// Rechaza una orden pagada → reembolso Stripe automático, se borra el
/// sponsorAds PENDING y la orden queda REJECTED. Si el reembolso falla
/// no se toca nada (el admin reintenta) — el dinero nunca queda
/// cobrado sin anuncio publicado.
/// Permisos: igual que approve — admin-only (órdenes siempre globales).
export default defineEventHandler(async (event): Promise<AdOrder> => {
  const staff = await requireStaff(event);
  if (staff.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Solo el admin' });
  }

  const body = await readBody<{ reason?: string }>(event);
  const reason = (body?.reason ?? '').trim().slice(0, 200);

  const orderRef = db()
    .collection('adOrders')
    .doc(getRouterParam(event, 'id') ?? '');
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw createError({ statusCode: 404, message: 'Orden no encontrada' });
  }
  const order = toAdOrder(orderSnap);
  requireBranchScope(staff, order.branchId);
  if (order.status !== 'PENDING_APPROVAL' || !order.sponsorAdId) {
    throw createError({
      statusCode: 409,
      message: 'Esta orden ya fue procesada',
    });
  }

  /// Reembolso primero — si Stripe falla se aborta y la orden sigue
  /// pendiente para reintentar.
  if (order.stripePaymentIntentId) {
    try {
      await useStripe().refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });
    } catch (error) {
      throw createError({
        statusCode: 502,
        statusMessage: `No se pudo reembolsar en Stripe — ${error instanceof Error ? error.message : 'error desconocido'}`,
      });
    }
  }

  const batch = db().batch();
  batch.delete(db().collection('sponsorAds').doc(order.sponsorAdId));
  batch.update(orderRef, {
    status: 'REJECTED',
    rejection_reason: reason || null,
    reviewed_at: FieldValue.serverTimestamp(),
    reviewed_by: staff.email || staff.uid,
  });
  await batch.commit();

  const brandName =
    ((await db().collection('config').doc('brand').get()).data()
      ?.name as string | undefined) ?? 'el gimnasio';
  await sendAdOrderRejectedEmail({
    to: order.email,
    businessName: order.businessName,
    brandName,
    amount: order.amount,
    reason,
  }).catch(() => {});

  return toAdOrder(await orderRef.get());
});
