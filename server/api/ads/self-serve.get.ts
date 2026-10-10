import type { AdSelfServeInfo } from '#shared/types';

import { db, toAdSelfServeConfig } from '../../utils/db';
import { rateLimit } from '../../utils/rate-limit';

/// Público (sin auth) — alimenta la página /anuncia con el nombre del
/// negocio, las sedes y los precios de venta directa configurados por
/// el admin en /publicidad. No expone nada sensible.
export default defineEventHandler(async (event): Promise<AdSelfServeInfo> => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'anon';
  await rateLimit(`ads-selfserve:${ip}`, 30, 60_000);

  const [configSnap, brandSnap, branchesSnap] = await Promise.all([
    db().collection('config').doc('ads').get(),
    db().collection('config').doc('brand').get(),
    db().collection('branches').get(),
  ]);
  const config = toAdSelfServeConfig(configSnap);

  return {
    enabled: config.enabled,
    brandName: (brandSnap.data()?.name as string | undefined) ?? '',
    branches: branchesSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name as string | undefined) ?? d.id,
    })),
    slots: config.slots,
  };
});
