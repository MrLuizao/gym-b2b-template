import type { SponsorAd } from '#shared/types';

import { db, toSponsorAd } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<SponsorAd> => {
  await requireStaff(event);
  const snap = await db()
    .collection('sponsorAds')
    .doc(getRouterParam(event, 'id') ?? '')
    .get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }
  return toSponsorAd(snap);
});
