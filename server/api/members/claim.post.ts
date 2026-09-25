import { FieldValue } from 'firebase-admin/firestore';

import type { Member } from '#shared/types';

import { db, toMember } from '../../utils/db';
import { requireUser } from '../../utils/staff-auth';

/// El socio reclama su alta de recepción: entra con Google/Apple,
/// escribe su member_number + el PIN de 6 dígitos que recepción le
/// envió por correo (contact_email) → el backend vincula el doc con
/// `auth_uid` y consume el PIN (single-use). El doc NO se mueve —
/// payments/checkins ya lo referencian.
export default defineEventHandler(async (event): Promise<{ member: Member }> => {
  const user = await requireUser(event);
  const body = await readBody<{ memberNumber?: string; pin?: string }>(event);

  const memberNumber = body?.memberNumber?.trim().toUpperCase() ?? '';
  const pin = (body?.pin ?? '').replace(/\D/g, '');
  if (!memberNumber || pin.length !== 6) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ingresa tu número de socio y el código de 6 dígitos',
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

  /// member_number es secuencial (adivinable) — el claim_pin enviado al
  /// correo registrado es el segundo factor. Un socio sin PIN (alta
  /// antigua) debe pedir uno nuevo en recepción.
  const storedPin = data.claim_pin as string | undefined;
  if (!storedPin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta cuenta no tiene código activo — pide uno en recepción',
    });
  }
  if (storedPin !== pin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Código incorrecto — revisa el correo que te envió recepción',
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
      /// El email del doc es el de login (Google/Apple) — el correo que
      /// recibió el PIN vive aparte en `contact_email` y no se toca.
      email: user.email || (data.email as string | null) || null,
      photo_url: data.photo_url ?? null,
      claim_pin: FieldValue.delete(),
    });
  }

  return { member: toMember(await doc.ref.get()) };
});
