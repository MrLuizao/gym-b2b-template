import type { AdsReportResponse } from '#shared/types';
import { PROMO_OPT_IN_RATE, TOTAL_DEVICES, useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event): AdsReportResponse => {
  const db = useMockDb();
  const query = getQuery(event);
  const from = typeof query.from === 'string' ? Number(query.from) : null;
  const to = typeof query.to === 'string' ? Number(query.to) : null;
  const branchId =
    typeof query.branchId === 'string' && query.branchId !== 'todas'
      ? query.branchId
      : null;

  const ads = db.ads.filter((ad) => {
    if (from !== null && ad.endsAt < from) return false;
    if (to !== null && ad.createdAt > to) return false;
    if (branchId !== null && ad.branchId !== null && ad.branchId !== branchId) {
      return false;
    }
    return true;
  });

  const impressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
  const taps = ads.reduce((sum, ad) => sum + ad.taps, 0);

  return {
    ads,
    stats: {
      impressions,
      taps,
      ctr: impressions > 0 ? Math.round((taps / impressions) * 1000) / 10 : 0,
      optedInMembers: Math.round(TOTAL_DEVICES * PROMO_OPT_IN_RATE),
    },
  };
});
