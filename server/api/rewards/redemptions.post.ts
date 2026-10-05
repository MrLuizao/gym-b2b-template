import { FieldValue } from 'firebase-admin/firestore';

import type { RewardRedemption } from '#shared/types';

import { db, toMs } from '../../utils/db';
import { requireBranchScope, requireStaff } from '../../utils/staff-auth';

/// POST /api/rewards/redemptions — recepción valida un código de canje:
/// `{code}` → lo marca `used`. Flujo: el socio muestra el código en la
/// app, el staff lo teclea/selecciona aquí.
export default defineEventHandler(async (event): Promise<RewardRedemption> => {
  const staff = await requireStaff(event);
  const body = await readBody<{ code?: string }>(event);
  const code = body?.code?.trim().toUpperCase() ?? '';
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Código requerido' });
  }

  const snap = await db()
    .collectionGroup('redemptions')
    .where('code', '==', code)
    .limit(1)
    .get();
  if (snap.empty) {
    throw createError({ statusCode: 404, statusMessage: 'Código no encontrado' });
  }
  const doc = snap.docs[0]!;
  const d = doc.data();

  requireBranchScope(staff, String(d.branch_id ?? ''));

  if (d.status !== 'active') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Este código ya fue usado o expiró',
    });
  }
  const expiresAt = toMs(d.expires_at) ?? 0;
  if (expiresAt > 0 && expiresAt < Date.now()) {
    await doc.ref.update({ status: 'expired' });
    throw createError({ statusCode: 409, statusMessage: 'El código expiró' });
  }

  await doc.ref.update({
    status: 'used',
    used_at: FieldValue.serverTimestamp(),
    used_by: staff.uid,
  });

  return {
    id: doc.id,
    memberId: String(d.member_id ?? ''),
    memberName: String(d.member_name ?? ''),
    branchId: String(d.branch_id ?? ''),
    rewardId: String(d.reward_id ?? ''),
    rewardName: String(d.reward_name ?? ''),
    pointsSpent: Number(d.points_spent ?? 0),
    code,
    status: 'used',
    createdAt: toMs(d.created_at) ?? 0,
    expiresAt,
    usedAt: Date.now(),
  };
});
