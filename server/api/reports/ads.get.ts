import type { AdsReportResponse } from '#shared/types';

import { db, toSponsorAd } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

const TOTAL_DEVICES = 1248;
const PROMO_OPT_IN_RATE = 0.68;

export default defineEventHandler(async (event): Promise<AdsReportResponse> => {
  const staff = await requireStaff(event);
  const query = getQuery(event);
  const from = typeof query.from === 'string' ? Number(query.from) : null;
  const to = typeof query.to === 'string' ? Number(query.to) : null;
  const branchId =
    staff.role !== 'ADMIN'
      ? staff.branchId
      : typeof query.branchId === 'string' && query.branchId !== 'todas'
        ? query.branchId
        : null;

  const snap = await db().collection('sponsorAds').get();
  const ads = snap.docs.map(toSponsorAd).filter((ad) => {
    if (from !== null && ad.endsAt < from) return false;
    if (to !== null && ad.createdAt > to) return false;
    if (branchId !== null && ad.branchId !== null && ad.branchId !== branchId) {
      return false;
    }
    return true;
  });

  const impressions = ads.reduce((s, a) => s + a.impressions, 0);
  const taps = ads.reduce((s, a) => s + a.taps, 0);

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
