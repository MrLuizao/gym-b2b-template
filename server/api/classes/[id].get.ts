import type { ClassDetail } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event): ClassDetail => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();

  const gymClass = db.classes.find((c) => c.id === id);
  if (!gymClass) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }

  return {
    gymClass,
    branches: db.branches.filter((b) => gymClass.branchIds.includes(b.id)),
    trainer: db.trainers.find((t) => t.name === gymClass.coach) ?? null,
  };
});
