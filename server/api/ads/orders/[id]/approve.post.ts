import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import type { AdOrder } from '#shared/types';

import { db, toAdOrder } from '../../../../utils/db';
import { sendAdOrderApprovedEmail } from '../../../../utils/mail';
import { sendPushDoc } from '../../../../utils/push';
import { requireBranchScope, requireStaff } from '../../../../utils/staff-auth';

/// Aprueba una orden pagada → el sponsorAds PENDING pasa a ACTIVE y la
/// vigencia arranca desde ahora (el anunciante no pierde días mientras
/// estuvo en revisión). Toda aprobación dispara el push INCLUIDO
/// (gancho de venta — 1 push a `all_members` con el título/subtítulo
/// del anuncio); si además compró paquete, se programan `push_pack`
/// pushLogs DRAFT con scheduled_at semanal que despacha el cron
/// /api/cron/push-dispatch. El push sale DESPUÉS del filtro humano,
/// nunca al pagar. Fallo de correo o FCM no tumba la aprobación
/// (queda push_error + push_log_ids para reintentar desde el CMS).
/// Permisos: admin — las órdenes siempre son globales (branch_id null)
/// así que requireBranchScope solo deja pasar al admin.
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

  /// Push incluido en TODA compra — se crea el pushLog y se envía al
  /// topic `all_members` (kind SPONSOR abre Aliados en la app, donde el
  /// anuncio ya está publicado). Los extra del paquete quedan
  /// programados a razón de 1 por semana como DRAFT con scheduled_at
  /// — los despacha /api/cron/push-dispatch. Los logs quedan ligados
  /// a la orden para trazabilidad y reintento desde /cms si FCM falla.
  if (!order.pushSentAt) {
    try {
      const pushDoc = {
        title: order.title,
        body: order.subtitle,
        audience: 'ALL',
        branch_id: null,
        kind: 'SPONSOR',
        target: 'allies',
        sent: 0,
        sponsor_ad_id: order.sponsorAdId,
        ad_order_id: order.id,
      };
      const logRef = await db().collection('pushLogs').add({
        ...pushDoc,
        status: 'DRAFT',
        scheduled_at: null,
        created_at: Timestamp.now(),
      });
      const logIds = [logRef.id];
      const res = await sendPushDoc(await logRef.get());

      /// Extras del paquete — programados semanalmente (aprox. a la
      /// misma hora de la aprobación). No se acotan por ends_at: el
      /// push es producto pagado y se entrega completo.
      for (let i = 1; i <= order.pushPack; i++) {
        const sched = await db().collection('pushLogs').add({
          ...pushDoc,
          status: 'DRAFT',
          scheduled_at: Timestamp.fromMillis(
            Date.now() + i * 7 * 86_400_000,
          ),
          created_at: Timestamp.now(),
        });
        logIds.push(sched.id);
      }

      await orderRef.update({
        push_log_ids: logIds,
        push_sent_at: res.fcmError ? null : FieldValue.serverTimestamp(),
        push_error: res.fcmError,
      });
    } catch (error) {
      await orderRef
        .update({
          push_error:
            error instanceof Error ? error.message : String(error),
        })
        .catch(() => {});
    }
  }

  return toAdOrder(await orderRef.get());
});
