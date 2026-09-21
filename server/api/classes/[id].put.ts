import type { ClassSchedule } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event): Promise<ClassSchedule> => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const gymClass = db.classes.find((c) => c.id === id);
  if (!gymClass) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }

  const body = await readBody<Partial<ClassSchedule>>(event);

  if (typeof body.name === 'string' && body.name.trim()) {
    gymClass.name = body.name.trim();
  }
  if (typeof body.coach === 'string' && body.coach.trim()) {
    gymClass.coach = body.coach.trim();
  }
  if (Array.isArray(body.branchIds)) {
    const valid = body.branchIds.filter((b) =>
      db.branches.some((branch) => branch.id === b),
    );
    if (valid.length) gymClass.branchIds = valid;
  }
  if (typeof body.room === 'string' && body.room.trim()) {
    gymClass.room = body.room.trim();
  }
  if (typeof body.startMinutes === 'number') {
    gymClass.startMinutes = Math.min(1439, Math.max(0, Math.round(body.startMinutes)));
  }
  if (typeof body.endMinutes === 'number') {
    gymClass.endMinutes = Math.min(1440, Math.max(1, Math.round(body.endMinutes)));
  }
  if (typeof body.capacity === 'number' && body.capacity >= 1) {
    gymClass.capacity = Math.round(body.capacity);
  }
  if (typeof body.booked === 'number' && body.booked >= 0) {
    gymClass.booked = Math.min(body.booked, gymClass.capacity);
  }

  return gymClass;
});
