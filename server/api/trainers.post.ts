import type { Trainer } from '#shared/types';

import { db, toTrainer } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

const VALID_SHIFTS = ['MAÑANA', 'TARDE', 'NOCHE'] as const;

export default defineEventHandler(async (event): Promise<Trainer> => {
  const staff = await requireStaff(event);
  const body = await readBody<{
    firstName?: string;
    middleName?: string;
    paternalLastName?: string;
    maternalLastName?: string;
    specialty?: string;
    shift?: string;
    branchIds?: string[];
  }>(event);

  const firstName = body?.firstName?.trim() ?? '';
  const paternalLastName = body?.paternalLastName?.trim() ?? '';
  if (!firstName || !paternalLastName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nombre y apellido paterno son obligatorios',
    });
  }
  const name = [
    firstName,
    body?.middleName?.trim(),
    paternalLastName,
    body?.maternalLastName?.trim(),
  ]
    .filter(Boolean)
    .join(' ');

  const specialty = body?.specialty?.trim() ?? '';
  if (!specialty) {
    throw createError({ statusCode: 400, statusMessage: 'La especialidad es obligatoria' });
  }

  const shift = VALID_SHIFTS.find((s) => s === body?.shift);
  if (!shift) {
    throw createError({ statusCode: 400, statusMessage: 'Turno inválido' });
  }

  const branchesSnap = await db().collection('branches').get();
  const validIds = new Set(branchesSnap.docs.map((d) => d.id));
  let branchIds = (body?.branchIds ?? []).filter((id) => validIds.has(id));

  /// El gerente solo crea entrenadores de su sede.
  if (staff.role !== 'ADMIN') {
    if (!staff.branchId) {
      throw createError({ statusCode: 403, statusMessage: 'Sin sede asignada' });
    }
    branchIds = [staff.branchId];
  }
  if (branchIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asigna al menos una sede válida',
    });
  }

  const ref = db().collection('trainers').doc();
  await ref.set({
    branch_ids: branchIds,
    name,
    first_name: firstName,
    middle_name: body?.middleName?.trim() || null,
    paternal_last_name: paternalLastName,
    maternal_last_name: body?.maternalLastName?.trim() || null,
    specialty,
    photo_url: `https://picsum.photos/seed/${ref.id.slice(0, 8)}/300/300`,
    shift,
    is_on_duty: false,
    active: true,
  });
  return toTrainer(await ref.get());
});
