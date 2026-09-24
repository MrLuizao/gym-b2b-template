import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../../../utils/db';
import { requireUser } from '../../../utils/staff-auth';

/// Reserva de clase por OCURRENCIA (fecha CDMX). El doc queda en
/// /bookings con class_date y el cupo vive en classes.booked_by_date
/// (classes.booked = inscritos de hoy, compat con clientes viejos).
/// El cliente nunca escribe esas colecciones directamente.

const MAX_AHEAD_DAYS = 8;

function todayCdmx(): { date: string; minutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default defineEventHandler(async (event) => {
  const { uid } = await requireUser(event);
  const classId = getRouterParam(event, 'id') ?? '';
  const body = await readBody<{ date?: string; branchId?: string }>(event);

  const { date: today, minutes: nowMinutes } = todayCdmx();
  const date =
    typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : today;
  if (date < today || date > addDays(today, MAX_AHEAD_DAYS)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Fecha de reserva fuera de rango',
    });
  }

  const classRef = db().collection('classes').doc(classId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }
  const gymClass = classSnap.data() ?? {};
  const branchIds = (gymClass.branch_ids as string[]) ?? [];

  /// Sede donde se toma la clase: la pedida, la del socio si aplica, o la
  /// primera de la clase. Debe ser una sede donde la clase se imparte.
  const branchId =
    typeof body?.branchId === 'string' && branchIds.includes(body.branchId)
      ? body.branchId
      : null;

  /// Socio por auth_uid (reclamo) o por doc id directo (seed).
  let memberSnap = await db().collection('users').doc(uid).get();
  if (!memberSnap.exists) {
    const q = await db()
      .collection('users')
      .where('auth_uid', '==', uid)
      .limit(1)
      .get();
    memberSnap = q.empty ? memberSnap : q.docs[0]!;
  }
  if (!memberSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }
  const member = memberSnap.data() ?? {};
  if (member.membership_status !== 'ACTIVE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Membresía vencida — pasa a caja para renovar',
    });
  }

  const bookingBranch =
    branchId ??
    (branchIds.includes(member.branch_id) ? member.branch_id : null) ??
    branchIds[0] ??
    '';

  /// Vigencia: si reserva para hoy, la clase no debe haber terminado
  /// (respeta el horario por sede de branch_times).
  const branchTime =
    (gymClass.branch_times as Record<string, { start_minutes?: number; end_minutes?: number }>)?.[
      bookingBranch
    ] ?? null;
  const endMinutes = Number(
    branchTime?.end_minutes ?? gymClass.end_minutes ?? 0,
  );
  if (date === today && endMinutes > 0 && nowMinutes >= endMinutes) {
    throw createError({
      statusCode: 409,
      statusMessage: 'La clase de hoy ya terminó',
    });
  }

  /// Reserva confirmada previa para ESA fecha → idempotente.
  /// Reservas viejas sin class_date cuentan en la fecha de created_at.
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const existing = await db()
    .collection('bookings')
    .where('class_id', '==', classId)
    .where('auth_uid', '==', uid)
    .get();
  const bookingsForDate = existing.docs.filter((d) => {
    const b = d.data();
    if (b.status !== 'confirmed') return false;
    const bDate =
      (b.class_date as string) ??
      (b.created_at?.toDate ? dateFmt.format(b.created_at.toDate()) : null);
    return bDate === date;
  });
  /// Misma sede → idempotente (doble toque, reintento).
  const active = bookingsForDate.find(
    (d) => (d.data().branch_id ?? '') === bookingBranch,
  );
  if (active) {
    return { ok: true, already: true, bookingId: active.id };
  }
  /// Otra sede → no se puede tener la misma clase en dos sedes a la vez.
  if (bookingsForDate.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Ya tienes esta clase reservada en otra sede — cancélala primero',
    });
  }

  /// Cupo por (fecha, sede) con transacción: dos reservas simultáneas
  /// no pueden rebasar capacity. Se podan fechas pasadas del mapa.
  /// booked_by_date: { 'YYYY-MM-DD': { <branchId>: n } } — un valor
  /// numérico plano es dato legacy y se migra a la sede de la reserva.
  const bookingRef = db().collection('bookings').doc();
  let bookedForSlot = 0;
  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(classRef);
      const data = snap.data() ?? {};
      const byDate = { ...(data.booked_by_date ?? {}) } as Record<
        string,
        number | Record<string, number>
      >;
      for (const k of Object.keys(byDate)) {
        if (k < today) {
          tx.update(classRef, { [`booked_by_date.${k}`]: FieldValue.delete() });
        }
      }
      const rawEntry = byDate[date];
      const perBranch: Record<string, number> =
        rawEntry == null
          ? {}
          : typeof rawEntry === 'number'
            ? { [bookingBranch]: rawEntry }
            : { ...rawEntry };

      /// Reservas viejas solo cuentan en classes.booked: se usa como base
      /// para hoy únicamente si el doc nunca ha escrito el mapa (si ya
      /// existe, `booked` podría traer el conteo obsoleto de ayer).
      const legacyBooked =
        data.booked_by_date == null && date === today
          ? Number(data.booked ?? 0)
          : 0;
      bookedForSlot = perBranch[bookingBranch] ?? legacyBooked;
      const capacity = Number(data.capacity ?? 0);
      if (capacity > 0 && bookedForSlot >= capacity) {
        throw createError({ statusCode: 409, statusMessage: 'Cupo lleno' });
      }
      bookedForSlot += 1;
      perBranch[bookingBranch] = bookedForSlot;
      const totalToday = Object.values(perBranch).reduce((a, b) => a + b, 0);
      tx.set(bookingRef, {
        class_id: classId,
        class_date: date,
        user_id: memberSnap.id,
        auth_uid: uid,
        member_name: member.name ?? '',
        branch_id: bookingBranch,
        status: 'confirmed',
        created_at: FieldValue.serverTimestamp(),
        cancelled_at: null,
      });
      tx.update(classRef, {
        [`booked_by_date.${date}`]: perBranch,
        ...(date === today ? { booked: totalToday } : {}),
      });
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e;
    throw createError({ statusCode: 500, statusMessage: 'No se pudo reservar' });
  }

  return {
    ok: true,
    bookingId: bookingRef.id,
    booked: bookedForSlot,
    date,
    branchId: bookingBranch,
  };
});
