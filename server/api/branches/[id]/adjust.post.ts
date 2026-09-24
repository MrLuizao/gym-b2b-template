import type { Branch } from '#shared/types';

import { FieldValue, db, toBranch } from '../../../utils/db';
import { requireBranchScope, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Branch> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';
  const body = await readBody<{ delta?: number; value?: number }>(event);

  const ref = db().collection('branches').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Sucursal no encontrada' });
  }
  /// Recepcionista solo VE el aforo — ajustar es admin (cualquiera) o
  /// gerente de la sede (requireBranchScope ya acota a la suya).
  if (staff.role === 'RECEPTIONIST') {
    throw createError({
      statusCode: 403,
      statusMessage: 'El aforo solo lo ajusta el gerente o el admin',
    });
  }
  requireBranchScope(staff, id);

  /// Ajuste manual del contador: `delta` relativo (+1/-1) o `value`
  /// absoluto ("fijar aforo en N"). Transacción con clamp [0, max] —
  /// los ajustes manuales NO crean check-ins ni tocan dailyStats.
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = Number(snap.data()?.current_capacity ?? 0);
    const max = Number(snap.data()?.max_capacity ?? 0);
    let next: number;
    if (typeof body?.value === 'number' && Number.isFinite(body.value)) {
      next = Math.round(body.value);
    } else {
      const delta = Math.trunc(Number(body?.delta ?? 0));
      if (!Number.isFinite(delta) || delta === 0) {
        throw createError({ statusCode: 400, statusMessage: 'Delta inválido' });
      }
      next = cur + delta;
    }
    next = Math.max(0, max > 0 ? Math.min(max, next) : next);
    tx.update(ref, {
      current_capacity: next,
      capacity_adjusted_at: FieldValue.serverTimestamp(),
      capacity_adjusted_by: staff.email || staff.uid,
    });
  });
  return toBranch(await ref.get());
});
