import type { CmsResponse } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((): CmsResponse => {
  const db = useMockDb();
  return {
    promos: [...db.promos].sort((a, b) => b.createdAt - a.createdAt),
    coupons: [...db.coupons].sort((a, b) => b.createdAt - a.createdAt),
    pushes: db.pushes,
    ads: [...db.ads].sort((a, b) => b.createdAt - a.createdAt),
  };
});
