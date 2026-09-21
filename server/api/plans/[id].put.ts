import type { MembershipPlan } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

const LEVELS = ['CLASSIC', 'PLUS', 'BLACK'] as const;

export default defineEventHandler(async (event): Promise<MembershipPlan> => {
  const id = getRouterParam(event, 'id');
  const db = useMockDb();

  const plan = db.plans.find((p) => p.id === id);
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan no encontrado' });
  }

  const body = await readBody<Partial<MembershipPlan>>(event);

  if (typeof body.name === 'string' && body.name.trim().length >= 3) {
    const oldName = plan.name;
    plan.name = body.name.trim();
    // mantener sincronizados socios y pagos que referencian el plan por nombre
    for (const member of db.members) {
      if (member.membershipType === oldName) member.membershipType = plan.name;
    }
    for (const payment of db.payments) {
      if (payment.plan === oldName) payment.plan = plan.name;
    }
  }
  if (
    typeof body.level === 'string' &&
    (LEVELS as readonly string[]).includes(body.level)
  ) {
    plan.level = body.level as MembershipPlan['level'];
  }
  if (typeof body.priceBs === 'number' && body.priceBs >= 0) {
    plan.priceBs = Math.round(body.priceBs);
  }
  if (Array.isArray(body.features)) {
    plan.features = body.features
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .map((f) => f.trim());
  }
  if (typeof body.highlight === 'boolean') {
    plan.highlight = body.highlight;
  }
  if (typeof body.allBranches === 'boolean') {
    plan.allBranches = body.allBranches;
  }

  return plan;
});
