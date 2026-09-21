import type { SponsorAd } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler((event): SponsorAd => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const ad = db.ads.find((item) => item.id === id);
  if (!ad) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }
  return ad;
});
