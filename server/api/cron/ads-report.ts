import { processExpiredAds } from '../../utils/ads-report';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

/// Cierre de campañas — marca EXPIRED los anuncios cuya `ends_at` ya
/// pasó y envía el reporte de métricas al anunciante (impresiones,
/// toques, CTR, pushes + CTA de renovación). Corre vía Vercel cron una
/// vez al día (~10:30 CDMX → 16:30 UTC) o manual con Bearer CRON_SECRET.
export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization') ?? '';
  if (!(CRON_SECRET && header === `Bearer ${CRON_SECRET}`)) {
    const { requireStaff, requireAdmin } = await import(
      '../../utils/staff-auth'
    );
    requireAdmin(await requireStaff(event));
  }

  const origin = getRequestURL(event).origin;
  const result = await processExpiredAds(`${origin}/anuncia`);
  return result;
});
