import { FieldValue } from 'firebase-admin/firestore';

import type { Member } from '#shared/types';

import { db, toMember, toMs } from '../../utils/db';
import { rateLimit } from '../../utils/rate-limit';
import { requireUser } from '../../utils/staff-auth';

/// El socio reclama su alta de recepción: entra con Google/Apple,
/// escribe su member_number + el PIN de 6 dígitos que recepción le
/// envió por correo (contact_email) → el backend vincula el doc con
/// `auth_uid` y consume el PIN (single-use). El doc NO se mueve —
/// payments/checkins ya lo referencian.
export default defineEventHandler(async (event): Promise<{ member: Member }> => {
  const user = await requireUser(event);
  /// Freno contra enumeración de member_number/PIN por bots.
  await rateLimit(`claim:${user.uid}`, 10, 10 * 60_000);
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

  /// Lockout anti fuerza-bruta del PIN: 3 fallos → 15 min bloqueado.
  /// `claim_attempts`/`claim_locked_until` viven en el doc del socio.
  const LOCK_AFTER = 3;
  const LOCK_MS = 15 * 60_000;
  const lockedUntil = toMs(data.claim_locked_until) ?? 0;
  if (lockedUntil > Date.now()) {
    throw createError({
      statusCode: 429,
      statusMessage:
        'Demasiados intentos fallidos — espera 15 minutos o pide ayuda en recepción',
    });
  }

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
    const attempts = Number(data.claim_attempts ?? 0) + 1;
    await doc.ref.update(
      attempts >= LOCK_AFTER
        ? {
            claim_attempts: 0,
            claim_locked_until: new Date(Date.now() + LOCK_MS),
          }
        : { claim_attempts: attempts },
    );
    throw createError({
      statusCode: 403,
      statusMessage:
        attempts >= LOCK_AFTER
          ? 'Demasiados intentos fallidos — espera 15 minutos o pide ayuda en recepción'
          : 'Código incorrecto — revisa el correo que te envió recepción',
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
      claim_attempts: FieldValue.delete(),
      claim_locked_until: FieldValue.delete(),
    });
  }

  return { member: toMember(await doc.ref.get()) };
});
