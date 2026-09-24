import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../../../utils/db';
import { requireUser } from '../../../utils/staff-auth';

/// Cancela la reserva confirmada del socio en esta clase para la fecha
/// indicada (default: hoy CDMX). Mantiene classes.booked_by_date y
/// classes.booked (inscritos de hoy) sincronizados.
export default defineEventHandler(async (event) => {
  const { uid } = await requireUser(event);
  const classId = getRouterParam(event, 'id') ?? '';
  const body = await readBody<{ date?: string; branchId?: string }>(event);
  const query = getQuery(event);
  const rawDate =
    (typeof query.date === 'string' ? query.date : null) ??
    (typeof body?.date === 'string' ? body.date : null);
  const rawBranch =
    (typeof query.branchId === 'string' ? query.branchId : null) ??
    (typeof body?.branchId === 'string' ? body.branchId : null);

  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = dateFmt.format(new Date());
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

  const existing = await db()
    .collection('bookings')
    .where('class_id', '==', classId)
    .where('auth_uid', '==', uid)
    .get();
  /// Reservas viejas sin class_date cuentan en la fecha de created_at.
  /// Si se pasa branchId, se cancela solo la reserva de ESA sede (una
  /// clase multi-sede puede tener una reserva por sede).
  const active = existing.docs.find((d) => {
    const b = d.data();
    if (b.status !== 'confirmed') return false;
    if (rawBranch && (b.branch_id ?? '') !== rawBranch) return false;
    const bDate =
      (b.class_date as string) ??
      (b.created_at?.toDate ? dateFmt.format(b.created_at.toDate()) : null);
    return bDate === date;
  });
  if (!active) {
    return { ok: true, already: true };
  }

  /// La sede del contador es la registrada en la propia reserva.
  const bookingBranch = String(active.data().branch_id ?? '');
  const classRef = db().collection('classes').doc(classId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(classRef);
    const byDate = (snap.data()?.booked_by_date ?? {}) as Record<
      string,
      number | Record<string, number>
    >;
    const rawEntry = byDate[date];
    const perBranch: Record<string, number> =
      rawEntry == null
        ? {}
        : typeof rawEntry === 'number'
          ? { [bookingBranch]: rawEntry }
          : { ...rawEntry };

    /// Reservas viejas no tienen booked_by_date: para hoy el contador real
    /// es classes.booked, pero solo si el doc nunca ha escrito el mapa.
    const legacyBooked =
      snap.data()?.booked_by_date == null && date === today
        ? Number(snap.data()?.booked ?? 0)
        : 1;
    const current = perBranch[bookingBranch] ?? legacyBooked;
    const next = Math.max(0, current - 1);
    perBranch[bookingBranch] = next;
    const totalToday = Object.values(perBranch).reduce((a, b) => a + b, 0);
    tx.update(active.ref, {
      status: 'cancelled',
      cancelled_at: FieldValue.serverTimestamp(),
    });
    tx.update(classRef, {
      [`booked_by_date.${date}`]: perBranch,
      ...(date === today ? { booked: totalToday } : {}),
    });
  });

  return { ok: true };
});
