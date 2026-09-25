import { Timestamp } from 'firebase-admin/firestore';

import type { Member } from '#shared/types';

import { db, toMember } from '../../utils/db';
import { requireBranchScope, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<Member> => {
  const staff = await requireStaff(event);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('users').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }
  const existing = snap.data() ?? {};
  requireBranchScope(staff, existing.branch_id as string);

  /// Recepción no edita — solo crea. Gerente/admin editan (scope por sede).
  if (staff.role === 'RECEPTIONIST') {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso de edición' });
  }

  const body = await readBody<{
    name?: string;
    phone?: string;
    contactEmail?: string;
    idNumber?: string;
    sex?: 'M' | 'F' | 'O' | null;
    birthDate?: string | null;
  }>(event);

  const update: Record<string, unknown> = {};
  if (body?.name !== undefined && body.name.trim()) {
    update.name = body.name.trim().slice(0, 80);
  }
  /// Datos de contacto y personales — el staff corrige capturas de
  /// recepción; contact_email es el canal del PIN de activación.
  if (body?.phone !== undefined) {
    update.phone = body.phone.trim() || null;
  }
  if (body?.contactEmail !== undefined) {
    const contactEmail = body.contactEmail.trim().toLowerCase();
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw createError({ statusCode: 400, statusMessage: 'Correo inválido' });
    }
    update.contact_email = contactEmail || null;
  }
  if (body?.idNumber !== undefined) {
    update.id_number = body.idNumber.trim() || null;
  }
  if (body?.sex !== undefined) {
    update.sex =
      body.sex === 'M' || body.sex === 'F' || body.sex === 'O'
        ? body.sex
        : null;
  }
  if (body?.birthDate !== undefined) {
    update.birth_date =
      typeof body.birthDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate) &&
      !Number.isNaN(Date.parse(body.birthDate))
        ? body.birthDate
        : null;
  }
  /// Sede, plan y vigencia NO se editan aquí: la reasignación de sede
  /// es un proceso operativo aparte, y plan/vigencia solo cambian con
  /// un cobro (POST /api/payments o el webhook de Stripe).

  if (Object.keys(update).length > 0) await ref.update(update);
  return toMember(await ref.get());
});
