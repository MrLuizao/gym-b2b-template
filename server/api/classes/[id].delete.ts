import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const index = db.classes.findIndex((c) => c.id === id);
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }
  db.classes.splice(index, 1);
  return { ok: true };
});
