import type { ClassBranchTime, ClassSchedule } from '#shared/types';

import { db, toClass } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<ClassSchedule> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('classes').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }
  const data = snap.data() ?? {};
  const branchIds = (data.branch_ids as string[]) ?? [];

  const body = await readBody<
    Partial<ClassSchedule> & {
      branchTime?: { branchId?: string } & Partial<ClassBranchTime>;
    }
  >(event);

  const update: Record<string, unknown> = {};

  if (staff.role === 'ADMIN') {
    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.coachId === 'string') {
      const t = await db().collection('trainers').doc(body.coachId).get();
      if (t.exists) {
        update.coach_id = t.id;
        update.coach = (t.data()?.name as string) ?? '';
      }
    }
    if (Array.isArray(body.branchIds) && body.branchIds.length) {
      const valid = new Set(
        (await db().collection('branches').get()).docs.map((d) => d.id),
      );
      const filtered = body.branchIds.filter((b) => valid.has(b));
      if (filtered.length) update.branch_ids = filtered;
    }
    if (typeof body.room === 'string' && body.room.trim()) {
      update.room = body.room.trim();
    }
    if (typeof body.startMinutes === 'number') {
      update.start_minutes = Math.min(1439, Math.max(0, Math.round(body.startMinutes)));
    }
    if (typeof body.endMinutes === 'number') {
      update.end_minutes = Math.min(1440, Math.max(1, Math.round(body.endMinutes)));
    }
    if (typeof body.capacity === 'number' && body.capacity >= 1) {
      update.capacity = Math.round(body.capacity);
    }
    if (typeof body.booked === 'number' && body.booked >= 0) {
      update.booked = Math.round(body.booked);
    }
  }

  /// branchTime: override local — gerente solo su sede; admin cualquiera.
  const branchTime = body.branchTime;
  if (branchTime && typeof branchTime.branchId === 'string') {
    const target = branchTime.branchId;
    if (staff.role !== 'ADMIN' && target !== staff.branchId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Solo puedes editar el horario de tu sede',
      });
    }
    if (
      branchIds.includes(target) &&
      typeof branchTime.startMinutes === 'number' &&
      typeof branchTime.endMinutes === 'number' &&
      typeof branchTime.room === 'string' &&
      branchTime.room.trim()
    ) {
      const times = {
        ...((data.branch_times as Record<string, unknown>) ?? {}),
        [target]: {
          start_minutes: Math.min(1439, Math.max(0, Math.round(branchTime.startMinutes))),
          end_minutes: Math.min(1440, Math.max(1, Math.round(branchTime.endMinutes))),
          room: branchTime.room.trim(),
        },
      };
      update.branch_times = times;
    }
  }

  /// Overrides de sedes que ya no imparten la clase se descartan.
  const finalBranchIds = (update.branch_ids as string[]) ?? branchIds;
  const finalTimes = (update.branch_times as Record<string, unknown>) ??
    (data.branch_times as Record<string, unknown>) ?? {};
  for (const key of Object.keys(finalTimes)) {
    if (!finalBranchIds.includes(key)) delete finalTimes[key];
  }
  if (update.branch_times || update.branch_ids) {
    update.branch_times = finalTimes;
  }

  if (Object.keys(update).length > 0) await ref.update(update);
  return toClass(await ref.get());
});
