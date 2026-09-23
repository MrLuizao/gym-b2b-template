import { Timestamp } from 'firebase-admin/firestore';

import type { Member, PaymentRecord } from '#shared/types';

import { db, toMember, toPayment } from '../utils/db';
import { requireBranchScope, requireStaff } from '../utils/staff-auth';

/// El formulario manda etiquetas ('Efectivo'…) — normaliza al enum del schema.
function normalizeMethod(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('efect') || m === 'cash') return 'cash';
  if (m.includes('transf')) return 'transfer';
  if (m.includes('terminal') || m.includes('tarjeta') || m === 'card') {
    return 'terminal';
  }
  return 'cash';
}

export default defineEventHandler(
  async (event): Promise<{ member: Member; payment: PaymentRecord }> => {
    const staff = await requireStaff(event);
    const body = await readBody<{
      firstName?: string;
      middleName?: string;
      paternalLastName?: string;
      maternalLastName?: string;
      sex?: 'M' | 'F' | 'O';
      birthDate?: string;
      phone?: string;
      idNumber?: string;
      branchId?: string;
      planId?: string;
      method?: string;
      amount?: number;
      folio?: string;
    }>(event);

    const firstName = body?.firstName?.trim() ?? '';
    const paternalLastName = body?.paternalLastName?.trim() ?? '';
    if (!firstName || !paternalLastName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nombre y apellido paterno son obligatorios',
      });
    }
    /// El nombre completo se compone de sus partes (segundo nombre y
    /// apellido materno son opcionales).
    const name = [
      firstName,
      body?.middleName?.trim(),
      paternalLastName,
      body?.maternalLastName?.trim(),
    ]
      .filter(Boolean)
      .join(' ');
    if (!body?.idNumber?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'La identificación es obligatoria',
      });
    }
    if (!body?.phone?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'El teléfono es obligatorio',
      });
    }

    /// Staff con sede fija solo inscribe socios en la suya.
    const branchId =
      staff.role === 'ADMIN' ? body?.branchId : staff.branchId;
    requireBranchScope(staff, branchId ?? null);

    const [branchSnap, planSnap] = await Promise.all([
      db().collection('branches').doc(branchId ?? '').get(),
      db().collection('plans').doc(body?.planId ?? '').get(),
    ]);
    if (!branchSnap.exists) {
      throw createError({ statusCode: 400, statusMessage: 'Sede inválida' });
    }
    if (!planSnap.exists || planSnap.data()?.active === false) {
      throw createError({ statusCode: 400, statusMessage: 'Plan inválido' });
    }
    const plan = planSnap.data() ?? {};

    /// Todo pago necesita folio: el de tarjeta/transferencia viene del
    /// tercero que lo procesó; en efectivo se genera un folio interno.
    const rawMethod = body?.method?.trim() || 'Efectivo';
    const method = normalizeMethod(rawMethod);
    const folio = body?.folio?.trim() || `TX-${Date.now()}`;
    if (method !== 'cash' && !body?.folio?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Ingresa el folio/comprobante que entregó el procesador de pago',
      });
    }

    const amount =
      typeof body?.amount === 'number' && body.amount > 0
        ? Math.round(body.amount)
        : Number(plan.price ?? 0);

    /// Siguiente member_number (CF-NNNNN) — zero-padded ordena bien.
    const last = await db()
      .collection('users')
      .orderBy('member_number', 'desc')
      .limit(1)
      .get();
    const lastNum = last.empty
      ? 0
      : Number(String(last.docs[0]!.get('member_number')).replace(/\D/g, ''));
    const memberNumber = `CF-${String(lastNum + 1).padStart(5, '0')}`;

    const memberRef = db().collection('users').doc();
    const paymentRef = db().collection('payments').doc();
    const until = Timestamp.fromMillis(Date.now() + 30 * 86_400_000);

    const batch = db().batch();
    batch.set(memberRef, {
      branch_id: branchId,
      name,
      photo_url: `https://picsum.photos/seed/${memberRef.id.slice(0, 8)}/300/300`,
      member_number: memberNumber,
      qr_code: memberRef.id,
      membership_status: 'ACTIVE',
      membership_plan_id: planSnap.id,
      membership_until: until,
      first_name: firstName,
      middle_name: body?.middleName?.trim() || null,
      paternal_last_name: paternalLastName,
      maternal_last_name: body?.maternalLastName?.trim() || null,
      sex: body?.sex ?? null,
      birth_date:
        typeof body?.birthDate === 'string' &&
        !Number.isNaN(Date.parse(body.birthDate))
          ? body.birthDate
          : null,
      phone: body?.phone?.trim() ?? null,
      id_number: body?.idNumber?.trim() ?? null,
      stripe_customer_id: null,
      last_checkin_at: null,
      active_checkin_id: null,
      active_checkin_branch: null,
      created_at: Timestamp.now(),
    });
    batch.set(paymentRef, {
      member_id: memberRef.id,
      member_name: name,
      member_number: memberNumber,
      branch_id: branchId,
      plan_id: planSnap.id,
      plan: (plan.name as string) ?? '',
      amount,
      currency: 'mxn',
      provider: 'manual',
      method,
      transaction_id: folio,
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      receipt_url: null,
      status: 'APPROVED',
      failure_reason: null,
      created_at: Timestamp.now(),
      created_by: 'reception',
      created_by_uid: staff.uid,
    });
    await batch.commit();

    const [memberSnap2, paymentSnap] = await Promise.all([
      memberRef.get(),
      paymentRef.get(),
    ]);
    return { member: toMember(memberSnap2), payment: toPayment(paymentSnap) };
  },
);
