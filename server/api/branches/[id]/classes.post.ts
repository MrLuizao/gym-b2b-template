import type { ClassSchedule } from '#shared/types';
import { randomUUID } from 'node:crypto';

import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler(async (event): Promise<ClassSchedule> => {
  const branchId = getRouterParam(event, 'id');
  const db = useMockDb();
  const branch = db.branches.find((b) => b.id === branchId);
  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: 'Sede no encontrada' });
  }

  const body = await readBody<Partial<ClassSchedule>>(event);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const coach = typeof body.coach === 'string' ? body.coach.trim() : '';
  if (name.length < 3 || !coach) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nombre y coach son obligatorios',
    });
  }

  const capacity =
    typeof body.capacity === 'number' && body.capacity >= 1
      ? Math.round(body.capacity)
      : 20;
  const startMinutes =
    typeof body.startMinutes === 'number'
      ? Math.min(1439, Math.max(0, Math.round(body.startMinutes)))
      : 360;
  const endMinutes =
    typeof body.endMinutes === 'number'
      ? Math.min(1440, Math.max(1, Math.round(body.endMinutes)))
      : startMinutes + 60;

  const gymClass: ClassSchedule = {
    id: randomUUID(),
    branchIds: [branchId as string],
    name,
    coach,
    room: typeof body.room === 'string' && body.room.trim() ? body.room.trim() : 'Sala 1',
    startMinutes,
    endMinutes: Math.max(endMinutes, startMinutes + 15),
    capacity,
    booked:
      typeof body.booked === 'number' && body.booked >= 0
        ? Math.min(Math.round(body.booked), capacity)
        : 0,
  };
  db.classes.push(gymClass);
  return gymClass;
});
