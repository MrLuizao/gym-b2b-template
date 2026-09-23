import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../../../utils/db';
import { requireUser } from '../../../utils/staff-auth';

/// Reserva de clase desde la app del socio. El doc queda en
/// /bookings y el contador classes.booked se mantiene aquí —
/// el cliente nunca escribe esas colecciones directamente.
export default defineEventHandler(async (event) => {
  const { uid } = await requireUser(event);
  const classId = getRouterParam(event, 'id') ?? '';

  const classRef = db().collection('classes').doc(classId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }
  const gymClass = classSnap.data() ?? {};

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

  /// Reserva confirmada previa → idempotente (doble toque, reintento).
  const existing = await db()
    .collection('bookings')
    .where('class_id', '==', classId)
    .where('auth_uid', '==', uid)
    .get();
  const active = existing.docs.find((d) => d.data().status === 'confirmed');
  if (active) {
    return { ok: true, already: true };
  }

  const booked = Number(gymClass.booked ?? 0);
  const capacity = Number(gymClass.capacity ?? 0);
  if (capacity > 0 && booked >= capacity) {
    throw createError({ statusCode: 409, statusMessage: 'Cupo lleno' });
  }

  const bookingRef = db().collection('bookings').doc();
  const batch = db().batch();
  batch.set(bookingRef, {
    class_id: classId,
    user_id: memberSnap.id,
    auth_uid: uid,
    member_name: member.name ?? '',
    branch_id: member.branch_id ?? '',
    status: 'confirmed',
    created_at: FieldValue.serverTimestamp(),
    cancelled_at: null,
  });
  batch.update(classRef, { booked: FieldValue.increment(1) });
  await batch.commit();

  return { ok: true, bookingId: bookingRef.id, booked: booked + 1 };
});
