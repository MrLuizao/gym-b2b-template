import { FieldPath, Timestamp } from 'firebase-admin/firestore';

import { db, toAdOrder } from './db';
import { sendAdReportEmail } from './mail';

const PLACEMENT_LABEL: Record<string, string> = {
  carousel: 'Carrusel destacado',
  list: 'Directorio de Aliados',
};

/// Métricas de la pauta de un anuncio — impresiones/taps únicos por
/// día de `adStats/{adId}_{fecha}` dentro de la vigencia [inicio, fin].
async function campaignStats(
  adId: string,
): Promise<{ impressions: number; taps: number }> {
  const snap = await db()
    .collection('adStats')
    .where(FieldPath.documentId(), '>=', `${adId}_`)
    .where(FieldPath.documentId(), '<=', `${adId}_\uf8ff`)
    .get();
  let impressions = 0;
  let taps = 0;
  for (const doc of snap.docs) {
    impressions += Number(doc.data().impressions ?? 0);
    taps += Number(doc.data().taps ?? 0);
  }
  return { impressions, taps };
}

/// Pushes de la orden que sí salieron (status SENT en pushLogs).
async function pushesSent(pushLogIds: string[]): Promise<number> {
  let sent = 0;
  for (const id of pushLogIds) {
    const snap = await db().collection('pushLogs').doc(id).get();
    if (snap.data()?.status === 'SENT') sent++;
  }
  return sent;
}

/// Manda el correo de cierre de campaña de una orden aprobada y marca
/// `report_sent_at`. Devuelve false si SMTP no está configurado (la
/// orden queda sin marcar y el cron reintenta al día siguiente).
export async function sendOrderReport(
  orderId: string,
  opts: { renewUrl: string; endsAt: number },
): Promise<boolean> {
  const orderSnap = await db().collection('adOrders').doc(orderId).get();
  if (!orderSnap.exists) return false;
  const order = toAdOrder(orderSnap);
  if (order.status !== 'APPROVED' || !order.sponsorAdId) return false;

  const brandName =
    ((await db().collection('config').doc('brand').get()).data()?.name as
      | string
      | undefined) ?? 'el gym';
  const stats = await campaignStats(order.sponsorAdId);
  const sent = await pushesSent(order.pushLogIds);

  const ok = await sendAdReportEmail({
    to: order.email,
    businessName: order.businessName,
    brandName,
    placementLabel: PLACEMENT_LABEL[order.placement] ?? order.placement,
    weeks: order.weeks,
    amount: order.amount,
    endsAt: opts.endsAt,
    impressions: stats.impressions,
    taps: stats.taps,
    pushesSent: sent,
    renewUrl: opts.renewUrl,
  });
  if (!ok) return false;

  await orderSnap.ref.update({ report_sent_at: Timestamp.now() });
  return true;
}

/// Barrido diario: marca EXPIRED los anuncios cuya vigencia terminó y
/// dispara el reporte por correo de las órdenes self-serve ligadas.
/// `renewUrl` = página pública de compra (CTA "Renovar campaña").
export async function processExpiredAds(
  renewUrl: string,
): Promise<{ expired: number; reports: number }> {
  const snap = await db()
    .collection('sponsorAds')
    .where('status', '==', 'ACTIVE')
    .get();

  let expired = 0;
  let reports = 0;
  for (const doc of snap.docs) {
    const endsAt = doc.data().ends_at?.toMillis?.() ?? 0;
    if (!endsAt || endsAt > Date.now()) continue;

    await doc.ref.update({ status: 'EXPIRED' });
    expired++;

    /// Solo las compras self-serve tienen orden (y correo del
    /// anunciante) — los anuncios cargados a mano no generan reporte.
    const orderId = doc.data().order_id as string | undefined;
    if (!orderId) continue;
    const orderSnap = await db().collection('adOrders').doc(orderId).get();
    if (!orderSnap.exists || orderSnap.data()?.report_sent_at) continue;
    if (await sendOrderReport(orderId, { renewUrl, endsAt })) reports++;
  }
  return { expired, reports };
}
