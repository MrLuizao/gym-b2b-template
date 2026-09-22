import type { Trainer } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

const SHIFTS = ['MAÑANA', 'TARDE', 'NOCHE'] as const;

export default defineEventHandler(async (event): Promise<Trainer> => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const trainer = db.trainers.find((t) => t.id === id);
  if (!trainer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Entrenador no encontrado',
    });
  }

  const body = await readBody<
    Partial<Trainer> & {
      addBranchId?: string;
      removeBranchId?: string;
      classIds?: string[];
    }
  >(event);

  if (typeof body.name === 'string' && body.name.trim().length >= 3) {
    const oldName = trainer.name;
    trainer.name = body.name.trim();
    // mantener sincronizadas las clases asignadas por nombre de coach
    for (const gymClass of db.classes) {
      if (gymClass.coach === oldName) gymClass.coach = trainer.name;
    }
  }
  if (typeof body.specialty === 'string' && body.specialty.trim()) {
    trainer.specialty = body.specialty.trim();
  }
  if (
    typeof body.shift === 'string' &&
    (SHIFTS as readonly string[]).includes(body.shift)
  ) {
    trainer.shift = body.shift as Trainer['shift'];
  }
  if (Array.isArray(body.branchIds)) {
    trainer.branchIds = body.branchIds.filter((b) =>
      db.branches.some((branch) => branch.id === b),
    );
  }
  if (
    typeof body.addBranchId === 'string' &&
    db.branches.some((b) => b.id === body.addBranchId) &&
    !trainer.branchIds.includes(body.addBranchId)
  ) {
    trainer.branchIds.push(body.addBranchId);
  }
  if (typeof body.removeBranchId === 'string') {
    trainer.branchIds = trainer.branchIds.filter(
      (b) => b !== body.removeBranchId,
    );
  }
  if (typeof body.isOnDuty === 'boolean') {
    trainer.isOnDuty = body.isOnDuty;
  }

  /// Asignación de clases: las incluidas apuntan a este coach; las que
  /// estaban con él y ya no vienen quedan "Sin asignar".
  if (Array.isArray(body.classIds)) {
    for (const gymClass of db.classes) {
      if (body.classIds.includes(gymClass.id)) {
        gymClass.coach = trainer.name;
      } else if (gymClass.coach === trainer.name) {
        gymClass.coach = 'Sin asignar';
      }
    }
  }

  return trainer;
});
