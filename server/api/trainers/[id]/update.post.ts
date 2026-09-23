import type { Trainer } from '#shared/types';

import { db, toTrainer } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

const SHIFTS = ['MAÑANA', 'TARDE', 'NOCHE'] as const;
/// Campos que el gerente puede tocar en coaches de su sede.
const MANAGER_KEYS = new Set(['shift', 'isOnDuty', 'addBranchId', 'removeBranchId']);

export default defineEventHandler(async (event): Promise<Trainer> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('trainers').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Entrenador no encontrado' });
  }
  const data = snap.data() ?? {};
  const currentBranchIds = (data.branch_ids as string[]) ?? [];

  const body = await readBody<
    Partial<Trainer> & {
      addBranchId?: string;
      removeBranchId?: string;
      classIds?: string[];
    }
  >(event);

  if (staff.role !== 'ADMIN') {
    if (!staff.branchId || !currentBranchIds.includes(staff.branchId)) {
      throw createError({ statusCode: 403, statusMessage: 'Fuera de tu sede' });
    }
    const bodyKeys = Object.keys(body ?? {});
    if (bodyKeys.some((k) => !MANAGER_KEYS.has(k))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'El gerente solo edita turno/disponibilidad y sede local',
      });
    }
  }

  const update: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim().length >= 3) {
    update.name = body.name.trim();
  }
  if (typeof body.specialty === 'string' && body.specialty.trim()) {
    update.specialty = body.specialty.trim();
  }
  if (
    typeof body.shift === 'string' &&
    (SHIFTS as readonly string[]).includes(body.shift)
  ) {
    update.shift = body.shift;
  }
  if (typeof body.isOnDuty === 'boolean') {
    update.is_on_duty = body.isOnDuty;
  }

  /// branch_ids: admin manda el arreglo completo; gerente solo add/remove
  /// de su propia sede.
  let branchIds = currentBranchIds;
  if (staff.role === 'ADMIN' && Array.isArray(body.branchIds)) {
    const valid = new Set(
      (await db().collection('branches').get()).docs.map((d) => d.id),
    );
    branchIds = body.branchIds.filter((b) => valid.has(b));
  }
  if (
    typeof body.addBranchId === 'string' &&
    (staff.role === 'ADMIN' || body.addBranchId === staff.branchId) &&
    !branchIds.includes(body.addBranchId)
  ) {
    branchIds = [...branchIds, body.addBranchId];
  }
  if (
    typeof body.removeBranchId === 'string' &&
    (staff.role === 'ADMIN' || body.removeBranchId === staff.branchId)
  ) {
    branchIds = branchIds.filter((b) => b !== body.removeBranchId);
  }
  update.branch_ids = branchIds;

  if (Object.keys(update).length > 0) await ref.update(update);

  /// Reasignación de clases por id (solo admin — es campo global).
  if (staff.role === 'ADMIN' && Array.isArray(body.classIds)) {
    const classesSnap = await db()
      .collection('classes')
      .where('coach_id', '==', id)
      .get();
    const newName = (update.name as string) ?? (data.name as string) ?? '';
    const batch = db().batch();
    for (const doc of classesSnap.docs) {
      if (!body.classIds.includes(doc.id)) {
        batch.update(doc.ref, { coach_id: '', coach: 'Sin asignar' });
      }
    }
    const toAssign = await Promise.all(
      body.classIds.map((cid) => db().collection('classes').doc(cid).get()),
    );
    for (const c of toAssign) {
      if (c.exists) batch.update(c.ref, { coach_id: id, coach: newName });
    }
    await batch.commit();
  } else if (typeof update.name === 'string') {
    /// La etiqueta `coach` es denormalizada — resincronizarla por coach_id.
    const classesSnap = await db()
      .collection('classes')
      .where('coach_id', '==', id)
      .get();
    const batch = db().batch();
    for (const doc of classesSnap.docs) {
      batch.update(doc.ref, { coach: update.name });
    }
    await batch.commit();
  }

  return toTrainer(await ref.get());
});
