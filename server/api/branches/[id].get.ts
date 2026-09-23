import type { BranchDetail } from '#shared/types';

import { db, toBranch, toClass, toTrainer } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<BranchDetail> => {
  await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const snap = await db().collection('branches').doc(id).get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Sede no encontrada' });
  }
  const branch = toBranch(snap);

  const [classesSnap, trainersSnap] = await Promise.all([
    db().collection('classes').where('branch_ids', 'array-contains', id).get(),
    db().collection('trainers').where('branch_ids', 'array-contains', id).get(),
  ]);
  const allTrainers = (
    await db().collection('trainers').get()
  ).docs.map(toTrainer);

  const classes = classesSnap.docs
    .map(toClass)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const trainers = trainersSnap.docs.map(toTrainer);

  return {
    branch,
    classes,
    trainers,
    availableTrainers: allTrainers.filter((t) => !t.branchIds.includes(id)),
    stats: {
      occupancy:
        branch.maxCapacity > 0 ? branch.currentCapacity / branch.maxCapacity : 0,
      classes: classes.length,
      trainersOnDuty: trainers.filter((t) => t.isOnDuty).length,
    },
  };
});
