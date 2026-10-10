import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import type { AdOrder } from '#shared/types';

import { db, toAdOrder } from '../../../../utils/db';
import { sendAdOrderApprovedEmail } from '../../../../utils/mail';
import { requireBranchScope, requireStaff } from '../../../../utils/staff-auth';

/// Aprueba una orden pagada → el sponsorAds PENDING pasa a ACTIVE y la
/// vigencia arranca desde ahora (el anunciante no pierde días mientras
/// estuvo en revisión). Fallo de correo no tumba la aprobación.
/// Permisos: admin cualquier orden; gerente solo órdenes de SU sede —
/// las de "todas las sedes" (branch_id null) son admin-only.
export default defineEventHandler(async (event): Promise<AdOrder> => {
  const staff = await requireStaff(event);
  if (staff.role !== 'ADMIN' && staff.role !== 'MANAGER') {
    throw createError({
      statusCode: 403,
      message: 'Solo admin o gerente de la sede',
    });
  }

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

  const endsAt = Date.now() + order.weeks * 7 * 86_400_000;
  const adRef = db().collection('sponsorAds').doc(order.sponsorAdId);

  const batch = db().batch();
  batch.update(adRef, {
    status: 'ACTIVE',
    ends_at: Timestamp.fromMillis(endsAt),
  });
  batch.update(orderRef, {
    status: 'APPROVED',
    reviewed_at: FieldValue.serverTimestamp(),
    reviewed_by: staff.email || staff.uid,
  });
  await batch.commit();

  const brandName =
    ((await db().collection('config').doc('brand').get()).data()
      ?.name as string | undefined) ?? 'el gimnasio';
  await sendAdOrderApprovedEmail({
    to: order.email,
    businessName: order.businessName,
    brandName,
    endsAt,
  }).catch(() => {});

  return toAdOrder(await orderRef.get());
});
