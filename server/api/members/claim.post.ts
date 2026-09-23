import type { Member } from '#shared/types';

import { db, toMember } from '../../utils/db';
import { requireUser } from '../../utils/staff-auth';

/// Solo dígitos — los teléfonos se guardan como los tecleó recepción.
function digits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/// El socio reclama su alta de recepción: entra con Google/Apple,
/// dicta su member_number + teléfono y el backend lo vincula con
/// `auth_uid`. El doc NO se mueve — payments/checkins ya lo referencian.
export default defineEventHandler(async (event): Promise<{ member: Member }> => {
  const user = await requireUser(event);
  const body = await readBody<{ memberNumber?: string; phone?: string }>(event);

  const memberNumber = body?.memberNumber?.trim().toUpperCase() ?? '';
  const phone = digits(body?.phone);
  if (!memberNumber || phone.length < 7) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ingresa tu número de socio y el teléfono registrado',
    });
  }

  const snap = await db()
    .collection('users')
    .where('member_number', '==', memberNumber)
    .limit(1)
    .get();
  if (snap.empty) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Número de socio no encontrado — verifícalo en recepción',
    });
  }

  const doc = snap.docs[0]!;
  const data = doc.data();

  /// member_number es secuencial (adivinable) — el teléfono registrado
  /// es el segundo factor. Comparamos los últimos 10 dígitos por si
  /// recepción guardó lada/prefijo distinto.
  const stored = digits(data.phone as string | undefined).slice(-10);
  const given = phone.slice(-10);
  if (stored.length < 7 || stored !== given) {
    throw createError({
      statusCode: 403,
      statusMessage: 'El teléfono no coincide con el registrado en recepción',
    });
  }

  const linked = data.auth_uid as string | undefined;
  if (linked && linked !== user.uid) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Este número ya está vinculado a otra cuenta — acude a recepción',
    });
  }

  if (linked !== user.uid) {
    await doc.ref.update({
      auth_uid: user.uid,
      email: user.email || (data.email as string | null) || null,
      photo_url: data.photo_url ?? null,
    });
  }

  return { member: toMember(await doc.ref.get()) };
});
