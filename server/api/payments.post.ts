import type { PaymentRecord } from '#shared/types';
import { randomUUID } from 'node:crypto';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler(async (event): Promise<PaymentRecord> => {
  const db = useMockDb();
  const body = await readBody<{
    memberId?: string;
    planId?: string;
    amount?: number;
    method?: string;
  }>(event);

  const member = db.members.find((m) => m.id === body?.memberId);
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }

  const plan = db.plans.find((p) => p.id === body?.planId);
  if (!plan) {
    throw createError({ statusCode: 400, statusMessage: 'Plan inválido' });
  }

  const amount =
    typeof body?.amount === 'number' && body.amount > 0
      ? Math.round(body.amount)
      : plan.price;

  const payment: PaymentRecord = {
    id: randomUUID(),
    memberId: member.id,
    memberName: member.name,
    branchId: member.branchId,
    plan: plan.name,
    amount: amount,
    method: body?.method?.trim() || 'Efectivo',
    transactionId: `TX-${Date.now()}`,
    status: 'APPROVED',
    createdAt: Date.now(),
  };
  db.payments.unshift(payment);

  /// El pago renueva la membresía: +30 días desde hoy o desde el vencimiento
  /// vigente, lo que sea mayor.
  member.membershipType = plan.name;
  member.membershipStatus = 'ACTIVE';
  member.membershipUntil =
    Math.max(Date.now(), member.membershipUntil ?? 0) + 30 * 86_400_000;

  return payment;
});
