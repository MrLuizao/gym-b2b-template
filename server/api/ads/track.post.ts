import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const db = useMockDb();
  const body = await readBody<{ adId?: string; event?: 'impression' | 'tap' }>(
    event,
  );
  const ad = db.ads.find((item) => item.id === body?.adId);
  if (!ad) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }
  if (body?.event === 'tap') {
    ad.taps += 1;
  } else {
    ad.impressions += 1;
  }
  return { ok: true };
});
