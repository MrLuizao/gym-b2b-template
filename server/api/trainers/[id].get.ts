import type { TrainerDetail } from '#shared/types';

import { db, toClass, toTrainer } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<TrainerDetail> => {
  await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const snap = await db().collection('trainers').doc(id).get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Entrenador no encontrado' });
  }

  const classesSnap = await db()
    .collection('classes')
    .where('coach_id', '==', id)
    .get();
  const classes = classesSnap.docs
    .map(toClass)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  return {
    trainer: toTrainer(snap),
    classes,
    stats: {
      classes: classes.length,
      students: classes.reduce((t, c) => t + c.booked, 0),
    },
  };
});
