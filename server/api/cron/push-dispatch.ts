import { dispatchDuePushLogs } from '../../utils/push';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

/// Despacha pushLogs DRAFT con scheduled_at vencido — es el motor de
/// los paquetes de push semanales que se venden como add-on en los
/// anuncios (se programan al aprobar la orden) y también reactiva el
/// scheduler manual del CMS. Corre vía Vercel cron una vez al día
/// (~10:00 CDMX → 16:00 UTC) o por cron externo con Bearer CRON_SECRET.
export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization') ?? '';
  if (!(CRON_SECRET && header === `Bearer ${CRON_SECRET}`)) {
    const { requireStaff, requireAdmin } = await import(
      '../../utils/staff-auth'
    );
    requireAdmin(await requireStaff(event));
  }

  const dispatched = await dispatchDuePushLogs(20);
  return { dispatched };
});
