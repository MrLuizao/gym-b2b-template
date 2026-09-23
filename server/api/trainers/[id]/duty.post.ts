import type { Trainer } from '#shared/types';

import { db, toTrainer } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Trainer> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('trainers').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Entrenador no encontrado' });
  }

  /// Gerente: solo coaches asignados a su sede.
  if (staff.role !== 'ADMIN') {
    const branchIds = (snap.data()?.branch_ids as string[]) ?? [];
    if (!staff.branchId || !branchIds.includes(staff.branchId)) {
      throw createError({ statusCode: 403, statusMessage: 'Fuera de tu sede' });
    }
  }

  await ref.update({ is_on_duty: !(snap.data()?.is_on_duty === true) });
  return toTrainer(await ref.get());
});
