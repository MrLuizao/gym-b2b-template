import type { PushLog } from '#shared/types';
import { useMockDb } from '../../../../utils/mock-db';

export default defineEventHandler((event): PushLog => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const log = db.pushes.find((item) => item.id === id);
  if (!log) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Notificación no encontrada',
    });
  }
  return log;
});
