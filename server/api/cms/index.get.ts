import type { CmsResponse } from '#shared/types';

import { db, toCoupon, toPromo, toPushLog, toSponsorAd } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<CmsResponse> => {
  await requireStaff(event);
  const [promotionsSnap, pushesSnap, adsSnap] = await Promise.all([
    db().collection('promotions').orderBy('created_at', 'desc').get(),
    db().collection('pushLogs').orderBy('created_at', 'desc').get(),
    db().collection('sponsorAds').orderBy('created_at', 'desc').get(),
  ]);
  return {
    promos: promotionsSnap.docs
      .filter((d) => d.get('type') === 'banner')
      .map(toPromo),
    coupons: promotionsSnap.docs
      .filter((d) => d.get('type') === 'coupon')
      .map(toCoupon),
    pushes: pushesSnap.docs.map(toPushLog),
    ads: adsSnap.docs.map(toSponsorAd),
  };
});
