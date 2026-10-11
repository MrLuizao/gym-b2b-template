import { sendOrderReport } from '../../../../utils/ads-report';
import { db } from '../../../../utils/db';
import { requireAdmin, requireStaff } from '../../../../utils/staff-auth';

/// Reenvío manual del reporte de campaña al anunciante — admin-only,
/// desde el detalle del anuncio en /publicidad. Sirve si el correo se
/// perdió o el anunciante lo pide de nuevo (vuelve a sellar
/// report_sent_at).
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const orderId = getRouterParam(event, 'id') ?? '';
  const orderSnap = await db().collection('adOrders').doc(orderId).get();
  if (!orderSnap.exists) {
    throw createError({ statusCode: 404, message: 'Orden no encontrada' });
  }
  const adId = orderSnap.data()?.sponsor_ad_id as string | undefined;
  const adSnap = adId
    ? await db().collection('sponsorAds').doc(adId).get()
    : null;
  const endsAt = adSnap?.data()?.ends_at?.toMillis?.() ?? Date.now();

  const origin = getRequestURL(event).origin;
  const ok = await sendOrderReport(orderId, {
    renewUrl: `${origin}/anuncia`,
    endsAt,
  });
  if (!ok) {
    throw createError({
      statusCode: 502,
      message:
        'No se pudo enviar el reporte — revisa la configuración SMTP',
    });
  }
  return { sent: true };
});
