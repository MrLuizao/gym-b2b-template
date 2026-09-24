import { db } from '../../utils/db';
import { sweepCheckins, sweepClassBookings } from '../../utils/close-day';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

/// Cierre de día: barre TODOS los check-ins vivos y los agrega en
/// dailyStats agrupados por su propia fecha — robusto ante la ventana
/// flexible de 1h de Vercel Hobby (puede correr ya pasada medianoche).
/// Programar ~23:55 CDMX (Vercel cron: 55 5 * * * UTC).
export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization') ?? '';
  if (CRON_SECRET && header === `Bearer ${CRON_SECRET}`) {
    // cron externo autorizado
  } else {
    const { requireStaff, requireAdmin } = await import(
      '../../utils/staff-auth'
    );
    requireAdmin(await requireStaff(event));
  }

  const snap = await db().collection('checkins').get();
  const results = await sweepCheckins(snap.docs);

  /// Reset de aforo y cupo de clases en todas las sedes.
  const branches = await db().collection('branches').get();
  let classes = 0;
  for (const branchDoc of branches.docs) {
    await branchDoc.ref.update({ current_capacity: 0 });
    classes += await sweepClassBookings(branchDoc.id);
  }

  return { swept: snap.size, days: results, classes };
});
