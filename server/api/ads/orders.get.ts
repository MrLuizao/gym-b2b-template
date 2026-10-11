import type { AdOrder } from '#shared/types';

import { db, toAdOrder } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

/// Órdenes de publicidad self-serve — las lista admin/gerente en
/// /publicidad. Contienen datos de contacto del anunciante — el
/// recepcionista no tiene acceso a la sección ni al endpoint.
/// (Todas las órdenes son globales: aprobar/rechazar es admin-only,
/// ver orders/[id]/approve|reject).
export default defineEventHandler(async (event): Promise<AdOrder[]> => {
  const staff = await requireStaff(event);
  if (staff.role === 'RECEPTIONIST') {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' });
  }
  const snap = await db()
    .collection('adOrders')
    .orderBy('created_at', 'desc')
    .limit(100)
    .get();
  return snap.docs.map(toAdOrder);
});
