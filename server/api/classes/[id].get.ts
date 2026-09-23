import type { ClassDetail } from '#shared/types';

import { db, toBranch, toClass, toTrainer } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<ClassDetail> => {
  await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const snap = await db().collection('classes').doc(id).get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }
  const gymClass = toClass(snap);

  const [branchesSnap, trainerSnap] = await Promise.all([
    db().collection('branches').get(),
    gymClass.coachId
      ? db().collection('trainers').doc(gymClass.coachId).get()
      : Promise.resolve(null),
  ]);

  return {
    gymClass,
    branches: branchesSnap.docs
      .map(toBranch)
      .filter((b) => gymClass.branchIds.includes(b.id)),
    trainer: trainerSnap?.exists ? toTrainer(trainerSnap) : null,
  };
});
