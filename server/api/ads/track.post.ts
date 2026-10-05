import { FieldValue } from 'firebase-admin/firestore';

import { verifyAppCheck } from '../../utils/app-check';
import { db } from '../../utils/db';
import { useAdmin } from '../../utils/firebase-admin';
import { rateLimit } from '../../utils/rate-limit';

const TZ = 'America/Mexico_City';

/// Lo llama la app del socio — requiere cualquier sesión válida (no staff).
/// Las métricas de anuncios son lo que se vende a patrocinadores, así que
/// se deduplican: un (ad, socio, evento) solo cuenta 1 vez por día vía
/// `adEvents/{adId}_{uid}_{fecha}_{evento}` — `create()` falla si ya
/// existe y se omite el incremento.
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await verifyAppCheck(event);
  const header = getHeader(event, 'authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Token requerido' });
  }
  let uid: string;
  try {
    uid = (await useAdmin().auth.verifyIdToken(token)).uid;
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Token inválido' });
  }
  await rateLimit(`track:${uid}`, 30, 60_000);

  const body = await readBody<{ adId?: string; event?: 'impression' | 'tap' }>(
    event,
  );
  const adId = body?.adId ?? '';
  const kind = body?.event === 'tap' ? 'tap' : 'impression';

  const ref = db().collection('sponsorAds').doc(adId);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const eventRef = db()
    .collection('adEvents')
    .doc(`${adId}_${uid}_${today}_${kind}`);

  try {
    await eventRef.create({
      ad_id: adId,
      uid,
      event: kind,
      date: today,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch {
    /// Ya contada hoy — respuesta ok pero sin inflar el contador.
    return { ok: true };
  }

  await Promise.all([
    ref.update(
      kind === 'tap'
        ? { taps: FieldValue.increment(1) }
        : { impressions: FieldValue.increment(1) },
    ),
    /// Serie diaria para reportes — `adStats/{adId}_{fecha}` solo se toca
    /// en eventos únicos reales (tras pasar el dedupe).
    db()
      .collection('adStats')
      .doc(`${adId}_${today}`)
      .set(
        {
          ad_id: adId,
          date: today,
          impressions: FieldValue.increment(kind === 'impression' ? 1 : 0),
          taps: FieldValue.increment(kind === 'tap' ? 1 : 0),
        },
        { merge: true },
      ),
  ]);
  return { ok: true };
});
