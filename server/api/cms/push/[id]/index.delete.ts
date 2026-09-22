import { useMockDb } from '../../../../utils/mock-db';

export default defineEventHandler((event) => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const index = db.pushes.findIndex((item) => item.id === id);
  if (index === -1) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Notificación no encontrada',
    });
  }
  db.pushes.splice(index, 1);
  return { ok: true };
});
