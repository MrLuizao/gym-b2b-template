import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler((event): { ok: true } => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const index = db.ads.findIndex((item) => item.id === id);
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }
  db.ads.splice(index, 1);
  return { ok: true };
});
