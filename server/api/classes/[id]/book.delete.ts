import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../../../utils/db';
import { requireUser } from '../../../utils/staff-auth';

/// Cancela la reserva confirmada del socio en esta clase.
export default defineEventHandler(async (event) => {
  const { uid } = await requireUser(event);
  const classId = getRouterParam(event, 'id') ?? '';

  const existing = await db()
    .collection('bookings')
    .where('class_id', '==', classId)
    .where('auth_uid', '==', uid)
    .get();
  const active = existing.docs.find((d) => d.data().status === 'confirmed');
  if (!active) {
    return { ok: true, already: true };
  }

  const classRef = db().collection('classes').doc(classId);
  const batch = db().batch();
  batch.update(active.ref, {
    status: 'cancelled',
    cancelled_at: FieldValue.serverTimestamp(),
  });
  batch.update(classRef, { booked: FieldValue.increment(-1) });
  await batch.commit();

  return { ok: true };
});
