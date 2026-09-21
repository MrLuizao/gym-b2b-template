import type { TrainerDetail } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event): TrainerDetail => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();

  const trainer = db.trainers.find((t) => t.id === id);
  if (!trainer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Entrenador no encontrado',
    });
  }

  const classes = db.classes
    .filter((c) => c.coach === trainer.name)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  return {
    trainer,
    classes,
    stats: {
      classes: classes.length,
      students: classes.reduce((total, c) => total + c.booked, 0),
    },
  };
});
