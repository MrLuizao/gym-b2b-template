import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();
  const index = db.plans.findIndex((p) => p.id === id);
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Plan no encontrado' });
  }
  const plan = db.plans[index]!;
  const membersOnPlan = db.members.filter(
    (m) => m.membershipType === plan.name,
  ).length;
  if (membersOnPlan > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `No se puede eliminar: ${membersOnPlan} socio(s) tienen este plan`,
    });
  }
  db.plans.splice(index, 1);
  return { ok: true };
});
