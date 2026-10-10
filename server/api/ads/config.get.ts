import type { AdSelfServeConfig } from '#shared/types';

import { db, toAdSelfServeConfig } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

/// Config completa de venta directa (staff) — a diferencia del GET
/// público /api/ads/self-serve, este incluye los correos de aviso
/// (notify) que no deben exponerse al público.
export default defineEventHandler(async (event): Promise<AdSelfServeConfig> => {
  await requireStaff(event);
  return toAdSelfServeConfig(await db().collection('config').doc('ads').get());
});
