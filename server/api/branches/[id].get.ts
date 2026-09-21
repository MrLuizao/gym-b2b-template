import type { BranchDetail } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event): BranchDetail => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();

  const branch = db.branches.find((b) => b.id === id);
  if (!branch || !id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Sede no encontrada',
    });
  }

  const classes = db.classes
    .filter((c) => c.branchIds.includes(id))
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const trainers = db.trainers.filter((t) => t.branchIds.includes(id));
  const availableTrainers = db.trainers.filter(
    (t) => !t.branchIds.includes(id),
  );

  return {
    branch,
    classes,
    trainers,
    availableTrainers,
    stats: {
      occupancy:
        branch.maxCapacity > 0 ? branch.currentCapacity / branch.maxCapacity : 0,
      classes: classes.length,
      trainersOnDuty: db.trainers.filter(
        (t) => t.branchIds.includes(id) && t.isOnDuty,
      ).length,
    },
  };
});
