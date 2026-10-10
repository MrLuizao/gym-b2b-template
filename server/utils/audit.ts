import { Timestamp } from 'firebase-admin/firestore';

import { db } from './db';
import type { StaffContext } from './staff-auth';

/// Evidencia de cambios excepcionales sobre anuncios comprados por
/// self-serve — /auditLogs es server-only (rules: read admin, write
/// false). Se escribe cuando el admin fuerza un downgrade de espacio,
/// pausa o borra un anuncio ligado a una orden pagada: la compra
/// quedó en Stripe y la orden en /adOrders — cualquier alteración
/// posterior debe dejar rastro de quién, cuándo y por qué.
export async function writeAdAudit(opts: {
  adId: string;
  orderId: string | null;
  advertiser: string;
  action:
    | 'PLACEMENT_DOWNGRADE'
    | 'PLACEMENT_UPGRADE'
    | 'PAUSE'
    | 'DELETE';
  staff: StaffContext;
  reason: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  snapshot?: Record<string, unknown>;
}): Promise<void> {
  await db().collection('auditLogs').add({
    entity: 'sponsorAd',
    entity_id: opts.adId,
    order_id: opts.orderId,
    advertiser: opts.advertiser,
    action: opts.action,
    actor_uid: opts.staff.uid,
    actor_email: opts.staff.email,
    reason: opts.reason,
    changes: opts.changes ?? {},
    snapshot: opts.snapshot ?? null,
    created_at: Timestamp.now(),
  });
}
