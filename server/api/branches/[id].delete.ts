import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const index = db.branches.findIndex((b) => b.id === id);
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Sede no encontrada' });
  }
  const branch = db.branches[index]!;
  const branchId = branch.id;

  const members = db.members.filter((m) => m.branchId === branchId).length;
  const classes = db.classes.filter((c) =>
    c.branchIds.includes(branchId),
  ).length;
  const trainers = db.trainers.filter((t) =>
    t.branchIds.includes(branchId),
  ).length;
  if (members + classes + trainers > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `No se puede eliminar '${branch.name}': tiene ${members} socio(s), ${classes} clase(s) y ${trainers} entrenador(es) asignados`,
    });
  }
  db.branches.splice(index, 1);
  return { ok: true };
});
