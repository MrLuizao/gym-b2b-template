import type { Trainer } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler(async (event): Promise<Trainer> => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const trainer = db.trainers.find((t) => t.id === id);
  if (!trainer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Entrenador no encontrado',
    });
  }
  trainer.isOnDuty = !trainer.isOnDuty;
  return trainer;
});
