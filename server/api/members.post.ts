import type { Member, PaymentRecord } from '#shared/types';
import { randomUUID } from 'node:crypto';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler(
  async (event): Promise<{ member: Member; payment: PaymentRecord }> => {
    const db = useMockDb();
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

    const branch = db.branches.find((b) => b.id === body?.branchId);
    if (!branch) {
      throw createError({ statusCode: 400, statusMessage: 'Sede inválida' });
    }

    const plan = db.plans.find((p) => p.id === body?.planId);
    if (!plan) {
      throw createError({ statusCode: 400, statusMessage: 'Plan inválido' });
    }

    /// Todo pago necesita folio: el de tarjeta/transferencia viene del
    /// tercero que lo procesó; en efectivo se genera un folio interno.
    const method = body?.method?.trim() || 'Efectivo';
    const folio = body?.folio?.trim() || `TX-${Date.now()}`;
    if (method !== 'Efectivo' && !body?.folio?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Ingresa el folio/comprobante que entregó el procesador de pago',
      });
    }

    const amount =
      typeof body?.amount === 'number' && body.amount > 0
        ? Math.round(body.amount)
        : plan.price;

    const nextNumber =
      Math.max(
        ...db.members.map(
          (m) => Number(m.memberNumber.replace(/\D/g, '')) || 0,
        ),
      ) + 1;

    const member: Member = {
      id: `user-${randomUUID().slice(0, 8)}`,
      branchId: branch.id,
      name,
      photoUrl: `https://picsum.photos/seed/${randomUUID().slice(0, 8)}/300/300`,
      membershipStatus: 'ACTIVE',
      membershipType: plan.name,
      memberNumber: `CF-${String(nextNumber).padStart(5, '0')}`,
      membershipUntil: Date.now() + 30 * 86_400_000,
      firstName,
      middleName: body?.middleName?.trim() || null,
      paternalLastName,
      maternalLastName: body?.maternalLastName?.trim() || null,
      sex: body?.sex ?? null,
      birthDate:
        typeof body?.birthDate === 'string' &&
        !Number.isNaN(Date.parse(body.birthDate))
          ? body.birthDate
          : null,
      phone: body?.phone?.trim() ?? null,
      idNumber: body?.idNumber?.trim() ?? null,
    };
    db.members.push(member);

    const payment: PaymentRecord = {
      id: randomUUID(),
      memberId: member.id,
      memberName: member.name,
      branchId: member.branchId,
      plan: plan.name,
      amount: amount,
      method,
      transactionId: folio,
      status: 'APPROVED',
      createdAt: Date.now(),
    };
    db.payments.unshift(payment);

    return { member, payment };
  },
);
