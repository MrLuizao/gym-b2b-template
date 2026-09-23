import { Timestamp } from 'firebase-admin/firestore';

import type { PaymentRecord } from '#shared/types';

import { db, toPayment } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

const ALLOWED_METHODS = new Set(['cash', 'transfer', 'terminal', 'card']);

export default defineEventHandler(async (event): Promise<PaymentRecord> => {
  const staff = await requireStaff(event);
  const body = await readBody<{
    memberId?: string;
    planId?: string;
    amount?: number;
    method?: string;
    folio?: string;
  }>(event);

  const memberSnap = await db()
    .collection('users')
    .doc(body?.memberId ?? '')
    .get();
  if (!memberSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }
  const member = memberSnap.data() ?? {};

  const planSnap = await db()
    .collection('plans')
    .doc(body?.planId ?? '')
    .get();
  if (!planSnap.exists || planSnap.data()?.active === false) {
    throw createError({ statusCode: 400, statusMessage: 'Plan inválido' });
  }
  const plan = planSnap.data() ?? {};

  /// El cobro se toma en la sede del staff (admin usa la del socio).
  const branchId = staff.branchId ?? (member.branch_id as string) ?? '';

  const method = ALLOWED_METHODS.has(body?.method ?? '')
    ? (body!.method as string)
    : 'cash';
  const amount =
    typeof body?.amount === 'number' && body.amount > 0
      ? Math.round(body.amount)
      : Number(plan.price ?? 0);

  const paymentRef = db().collection('payments').doc();
  /// La membresía se extiende +30d desde max(hoy, vencimiento vigente).
  const currentUntil = (member.membership_until as Timestamp | null)?.toMillis() ?? 0;
  const newUntil = Math.max(Date.now(), currentUntil) + 30 * 86_400_000;

  const batch = db().batch();
  batch.set(paymentRef, {
    member_id: memberSnap.id,
    member_name: member.name ?? '',
    member_number: member.member_number ?? '',
    branch_id: branchId,
    plan_id: planSnap.id,
    plan: (plan.name as string) ?? '',
    amount,
    currency: 'mxn',
    provider: 'manual',
    method,
    transaction_id: body?.folio?.trim() || `TX-${Date.now()}`,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    receipt_url: null,
    status: 'APPROVED',
    failure_reason: null,
    created_at: Timestamp.now(),
    created_by: 'reception',
    created_by_uid: staff.uid,
  });
  batch.update(memberSnap.ref, {
    membership_plan_id: planSnap.id,
    membership_status: 'ACTIVE',
    membership_until: Timestamp.fromMillis(newUntil),
  });
  await batch.commit();

  return toPayment(await paymentRef.get());
});
