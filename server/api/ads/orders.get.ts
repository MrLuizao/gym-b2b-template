import type { AdOrder } from '#shared/types';

import { db, toAdOrder } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

/// Órdenes de publicidad self-serve — staff las lista en /publicidad
/// (el gerente ve todas; aprueba/rechaza solo las de su sede — las de
/// "todas las sedes" son admin-only, ver orders/[id]/approve|reject).
export default defineEventHandler(async (event): Promise<AdOrder[]> => {
  await requireStaff(event);
  const snap = await db()
    .collection('adOrders')
    .orderBy('created_at', 'desc')
    .limit(100)
    .get();
  return snap.docs.map(toAdOrder);
});
