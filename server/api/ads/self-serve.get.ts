import type { AdSelfServeInfo } from '#shared/types';
import { CAROUSEL_SLOTS } from '#shared/types';

import { db, toAdSelfServeConfig } from '../../utils/db';
import { rateLimit } from '../../utils/rate-limit';

/// Público (sin auth) — alimenta la página /anuncia con el nombre del
/// negocio, las sedes, los precios de venta directa y la ocupación del
/// carrusel (para avisar "los 5 espacios están llenos, próximo libre
/// aprox. el X" sin bloquear la venta). No expone nada sensible.
export default defineEventHandler(async (event): Promise<AdSelfServeInfo> => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'anon';
  await rateLimit(`ads-selfserve:${ip}`, 30, 60_000);

  const [configSnap, brandSnap, branchesSnap, adsSnap, ordersSnap] =
    await Promise.all([
      db().collection('config').doc('ads').get(),
      db().collection('config').doc('brand').get(),
      db().collection('branches').get(),
      db().collection('sponsorAds').where('status', '==', 'ACTIVE').get(),
      db()
        .collection('adOrders')
        .where('status', '==', 'PENDING_APPROVAL')
        .get(),
    ]);
  const config = toAdSelfServeConfig(configSnap);

  /// Ocupación del carrusel: ads ACTIVE de placement carousel (los
  /// 'both' legacy cuentan igual) + órdenes ya pagadas en revisión.
  /// `ends` junta las fechas en que cada lugar se libera; las órdenes
  /// pendientes no tienen ends_at todavía (arranca al aprobarse) — se
  /// estima hoy + semanas, de ahí el "aprox." del copy.
  const now = Date.now();
  const ends: number[] = [];
  let occupied = 0;
  for (const doc of adsSnap.docs) {
    const d = doc.data();
    if (d.placement === 'list') continue;
    const ms =
      typeof d.ends_at?.toMillis === 'function' ? d.ends_at.toMillis() : 0;
    if (ms > 0 && ms <= now) continue; /// ya vencido — el lugar está libre
    occupied++;
    if (ms > now) ends.push(ms);
  }
  for (const doc of ordersSnap.docs) {
    const d = doc.data();
    if (d.placement === 'list') continue;
    occupied++;
    ends.push(now + (Number(d.weeks) || 1) * 7 * 86_400_000);
  }
  ends.sort((a, b) => a - b);
  /// Un comprador nuevo entra al carrusel cuando queden <SLOTS lugares
  /// comprometidos — el (occupied - slots + 1)° vencimiento más próximo.
  const nextFreeAt =
    occupied >= CAROUSEL_SLOTS && ends.length > occupied - CAROUSEL_SLOTS
      ? ends[occupied - CAROUSEL_SLOTS]
      : null;

  return {
    enabled: config.enabled,
    brandName: (brandSnap.data()?.name as string | undefined) ?? '',
    branches: branchesSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name as string | undefined) ?? d.id,
      lat: typeof d.data().lat === 'number' ? d.data().lat : null,
      lng: typeof d.data().lng === 'number' ? d.data().lng : null,
    })),
    slots: config.slots,
    push: config.push,
    carousel: {
      slots: CAROUSEL_SLOTS,
      occupied,
      nextFreeAt,
    },
  };
});
