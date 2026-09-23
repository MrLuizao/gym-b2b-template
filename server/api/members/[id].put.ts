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
    branchId?: string;
    membershipPlanId?: string;
    membershipUntil?: number | null;
  }>(event);

  const update: Record<string, unknown> = {};
  if (body?.name !== undefined && body.name.trim()) {
    update.name = body.name.trim().slice(0, 80);
  }
  if (body?.branchId !== undefined) {
    /// Reasignar sede solo lo puede el admin global.
    if (staff.role !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: 'Solo admin reasigna sede' });
    }
    update.branch_id = body.branchId;
  }
  if (body?.membershipPlanId !== undefined && body.membershipPlanId.trim()) {
    const planSnap = await db()
      .collection('plans')
      .doc(body.membershipPlanId)
      .get();
    if (!planSnap.exists) {
      throw createError({ statusCode: 400, statusMessage: 'Plan inválido' });
    }
    update.membership_plan_id = planSnap.id;
    update.membership_status = 'ACTIVE';
  }
  if (body?.membershipUntil !== undefined) {
    update.membership_until =
      typeof body.membershipUntil === 'number'
        ? Timestamp.fromMillis(body.membershipUntil)
        : null;
  }

  if (Object.keys(update).length > 0) await ref.update(update);
  return toMember(await ref.get());
});
