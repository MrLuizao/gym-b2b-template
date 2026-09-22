import type { ClassBranchTime, ClassSchedule } from '#shared/types';
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

  const branchTime = (
    body as Partial<ClassSchedule> & {
      branchTime?: { branchId?: string } & Partial<ClassBranchTime>;
    }
  ).branchTime;
  if (
    branchTime &&
    typeof branchTime.branchId === 'string' &&
    gymClass.branchIds.includes(branchTime.branchId) &&
    typeof branchTime.startMinutes === 'number' &&
    typeof branchTime.endMinutes === 'number' &&
    typeof branchTime.room === 'string' &&
    branchTime.room.trim()
  ) {
    gymClass.branchTimes = {
      ...gymClass.branchTimes,
      [branchTime.branchId]: {
        startMinutes: Math.min(1439, Math.max(0, Math.round(branchTime.startMinutes))),
        endMinutes: Math.min(1440, Math.max(1, Math.round(branchTime.endMinutes))),
        room: branchTime.room.trim(),
      },
    };
  }

  /// Overrides de sedes que ya no imparten la clase se descartan.
  if (gymClass.branchTimes) {
    for (const key of Object.keys(gymClass.branchTimes)) {
      if (!gymClass.branchIds.includes(key)) delete gymClass.branchTimes[key];
    }
  }

  return gymClass;
});
