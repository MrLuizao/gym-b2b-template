import type { Trainer } from '#shared/types';
import { randomUUID } from 'node:crypto';
import { useMockDb } from '../utils/mock-db';

const VALID_SHIFTS = ['MAÑANA', 'TARDE', 'NOCHE'] as const;

export default defineEventHandler(async (event): Promise<Trainer> => {
  const db = useMockDb();
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
    throw createError({
      statusCode: 400,
      statusMessage: 'La especialidad es obligatoria',
    });
  }

  const shift = VALID_SHIFTS.find((s) => s === body?.shift);
  if (!shift) {
    throw createError({ statusCode: 400, statusMessage: 'Turno inválido' });
  }

  const branchIds = (body?.branchIds ?? []).filter((id) =>
    db.branches.some((b) => b.id === id),
  );
  if (branchIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asigna al menos una sede válida',
    });
  }

  const trainer: Trainer = {
    id: `t-${randomUUID().slice(0, 8)}`,
    branchIds,
    name,
    firstName,
    middleName: body?.middleName?.trim() || null,
    paternalLastName,
    maternalLastName: body?.maternalLastName?.trim() || null,
    specialty,
    photoUrl: `https://picsum.photos/seed/${randomUUID().slice(0, 8)}/300/300`,
    shift,
    isOnDuty: false,
  };
  db.trainers.push(trainer);

  return trainer;
});
