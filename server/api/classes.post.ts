import type { ClassSchedule } from '#shared/types';

import { db, toClass } from '../utils/db';
import { requireAdmin, requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<ClassSchedule> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<Partial<ClassSchedule>>(event);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const trainerSnap = await db()
    .collection('trainers')
    .doc(body.coachId ?? '')
    .get();
  if (name.length < 3 || !trainerSnap.exists) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nombre y coach son obligatorios',
    });
  }
  const trainer = trainerSnap.data() ?? {};

  const valid = new Set(
    (await db().collection('branches').get()).docs.map((d) => d.id),
  );
  const branchIds = Array.isArray(body.branchIds)
    ? body.branchIds.filter((id): id is string => typeof id === 'string' && valid.has(id))
    : [];
  if (branchIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona al menos una sede' });
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

  const ref = db().collection('classes').doc();
  await ref.set({
    branch_ids: branchIds,
    name,
    coach_id: trainerSnap.id,
    coach: (trainer.name as string) ?? '',
    room:
      typeof body.room === 'string' && body.room.trim()
        ? body.room.trim()
        : 'Sala 1',
    start_minutes: startMinutes,
    end_minutes: Math.max(endMinutes, startMinutes + 15),
    capacity,
    booked: 0,
    branch_times: {},
  });
  return toClass(await ref.get());
});
