import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../../utils/db';
import { useAdmin } from '../../utils/firebase-admin';

/// Lo llama la app del socio — requiere cualquier sesión válida (no staff).
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const header = getHeader(event, 'authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Token requerido' });
  }
  try {
    await useAdmin().auth.verifyIdToken(token);
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Token inválido' });
  }

  const body = await readBody<{ adId?: string; event?: 'impression' | 'tap' }>(
    event,
  );
  const ref = db().collection('sponsorAds').doc(body?.adId ?? '');
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }
  await ref.update(
    body?.event === 'tap'
      ? { taps: FieldValue.increment(1) }
      : { impressions: FieldValue.increment(1) },
  );
  return { ok: true };
});
