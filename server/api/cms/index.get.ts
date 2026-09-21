import type { Coupon, PromoBanner, PushLog } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((): { promos: PromoBanner[]; coupons: Coupon[]; pushes: PushLog[] } => {
  const db = useMockDb();
  return {
    promos: [...db.promos].sort((a, b) => b.createdAt - a.createdAt),
    coupons: [...db.coupons].sort((a, b) => b.createdAt - a.createdAt),
    pushes: db.pushes,
  };
});
