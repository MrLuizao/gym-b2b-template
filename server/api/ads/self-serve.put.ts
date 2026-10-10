import { FieldValue } from 'firebase-admin/firestore';

import type { AdSelfServeConfig } from '#shared/types';

import { db, toAdSelfServeConfig } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Guarda /config/ads — precios de venta directa por espacio, el
/// add-on push y correos de aviso (globales + por sede). Solo admin.
export default defineEventHandler(async (event): Promise<AdSelfServeConfig> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<{
    enabled?: boolean;
    slots?: {
      carousel?: { enabled?: boolean; pricePerWeek?: number };
      list?: { enabled?: boolean; pricePerWeek?: number };
    };
    push?: { enabled?: boolean; count?: number; price?: number };
    notify?: {
      global?: string[];
      byBranch?: Record<string, string>;
    };
  }>(event);

  const clean = (slot?: { enabled?: boolean; pricePerWeek?: number }) => ({
    enabled: slot?.enabled !== false,
    price_per_week: Math.max(0, Math.round(Number(slot?.pricePerWeek ?? 0))),
  });

  /// Correos de aviso — globales (max 10) y por sede (la llave debe ser
  /// una sede real; el valor, un email válido).
  const branchIds = new Set(
    (await db().collection('branches').get()).docs.map((d) => d.id),
  );
  const notifyGlobal = (Array.isArray(body?.notify?.global) ? body!.notify!.global! : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e))
    .slice(0, 10);
  const notifyByBranch = Object.fromEntries(
    Object.entries(body?.notify?.byBranch ?? {})
      .map(([k, v]) => [k, String(v).trim().toLowerCase()] as const)
      .filter(([k, v]) => branchIds.has(k) && EMAIL_RE.test(v)),
  );

  const ref = db().collection('config').doc('ads');
  const update: Record<string, unknown> = {
    enabled: Boolean(body?.enabled),
    slots: {
      carousel: clean(body?.slots?.carousel),
      list: clean(body?.slots?.list),
    },
    updated_at: FieldValue.serverTimestamp(),
    updated_by: staff.uid,
  };
  /// Defensivo — solo se pisa notify/push cuando el cliente lo manda;
  /// un guardado sin esos bloques nunca borra lo ya configurado.
  if (body?.notify) {
    update.notify = { global: notifyGlobal, by_branch: notifyByBranch };
  }
  if (body?.push) {
    update.push = {
      enabled: body.push.enabled === true,
      /// Paquete de pushes extra semanales — 1..52 tope razonable.
      count: Math.min(
        52,
        Math.max(0, Math.round(Number(body.push.count ?? 0))),
      ),
      price: Math.max(0, Math.round(Number(body.push.price ?? 0))),
    };
  }
  await ref.set(update, { merge: true });
  return toAdSelfServeConfig(await ref.get());
});
