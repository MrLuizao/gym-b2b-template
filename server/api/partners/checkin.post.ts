import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import type { CheckInResult, PartnerProvider } from '#shared/types';

import { closeExpiry } from '../../utils/checkin-shared';
import { db, toCheckIn } from '../../utils/db';
import { PARTNER_LABELS, validatePartnerToken } from '../../utils/partners';
import { requireBranchScope, requireStaff } from '../../utils/staff-auth';

/// Check-in de agregadores (Wellhub/TotalPass): recepción escanea el
/// token del día que el usuario genera en la app del agregador → el
/// server lo valida contra `validatePartnerToken` (mock en dev, API
/// real con credenciales del convenio) → misma mecánica de aforo y
/// TTL que el check-in de socios. Sin doc en /users — user_id = null.
export default defineEventHandler(async (event): Promise<CheckInResult> => {
  const staff = await requireStaff(event);
  const body = await readBody<{
    provider?: string;
    token?: string;
    branchId?: string;
  }>(event);

  const provider = body?.provider as PartnerProvider | undefined;
  if (provider !== 'wellhub' && provider !== 'totalpass') {
    throw createError({ statusCode: 400, statusMessage: 'Proveedor inválido' });
  }
  const token = body?.token?.trim() ?? '';
  const branchId = body?.branchId ?? staff.branchId ?? '';
  requireBranchScope(staff, branchId);

  const branchSnap = await db().collection('branches').doc(branchId).get();
  if (!branchSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Sucursal no encontrada' });
  }
  const branch = branchSnap.data() ?? {};
  const label = PARTNER_LABELS[provider];

  const writeRecord = (granted: boolean, reason: string | null, v?: {
    externalId?: string;
    name?: string;
    tier?: string;
  }) =>
    db().collection('checkins').add({
      user_id: null,
      provider,
      external_id: v?.externalId ?? null,
      branch_id: branchId,
      member_name: v?.name ?? `${label} visitante`,
      membership_type: v?.tier ? `${label} ${v.tier}` : label,
      membership_plan_id: '',
      method: 'partner',
      granted,
      reason,
      membership_alert: granted ? 'GREEN' : 'RED',
      check_in_at: FieldValue.serverTimestamp(),
      checked_out: false,
      checked_out_at: null,
      expires_at: null,
    });

  /// Token inválido → denegado y registrado.
  const validation = await validatePartnerToken(provider, token);
  if (!validation.ok) {
    await writeRecord(false, 'PARTNER_TOKEN_INVALID');
    return {
      granted: false,
      alert: 'RED',
      reason: 'PARTNER_TOKEN_INVALID',
      message: validation.error ?? 'Token inválido o expirado',
      member: partnerView(validation, label),
    };
  }

  /// Un token válido solo rinde una entrada por día (el agregador suele
  /// emitir uno por día — el dedupe es respaldo local).
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dup = await db()
    .collection('checkins')
    .where('provider', '==', provider)
    .where('external_id', '==', validation.externalId)
    .where('check_in_at', '>=', Timestamp.fromDate(dayStart))
    .get();
  if (dup.docs.some((d) => d.get('granted') === true)) {
    await writeRecord(false, 'ALREADY_CHECKED_IN', validation);
    return {
      granted: false,
      alert: 'YELLOW',
      reason: 'ALREADY_CHECKED_IN',
      message: 'Este usuario ya registró entrada hoy',
      member: partnerView(validation, label),
    };
  }

  const current = Number(branch.current_capacity ?? 0);
  const max = Number(branch.max_capacity ?? 0);
  if (max > 0 && current >= max) {
    await writeRecord(false, 'BRANCH_FULL', validation);
    return {
      granted: false,
      alert: 'RED',
      reason: 'BRANCH_FULL',
      member: partnerView(validation, label),
    };
  }

  const recordRef = db().collection('checkins').doc();
  const batch = db().batch();
  batch.set(recordRef, {
    user_id: null,
    provider,
    external_id: validation.externalId ?? null,
    branch_id: branchId,
    member_name: validation.name ?? `${label} visitante`,
    membership_type: validation.tier ? `${label} ${validation.tier}` : label,
    membership_plan_id: '',
    method: 'partner',
    granted: true,
    reason: null,
    membership_alert: 'GREEN',
    check_in_at: FieldValue.serverTimestamp(),
    checked_out: false,
    checked_out_at: null,
    expires_at: closeExpiry(Number(branch.close_minutes ?? 1320)),
  });
  batch.update(branchSnap.ref, {
    current_capacity: FieldValue.increment(1),
  });
  await batch.commit();

  return {
    granted: true,
    alert: 'GREEN',
    message: `Acceso ${label} registrado`,
    member: partnerView(validation, label),
    record: toCheckIn(await recordRef.get()),
  };
});

/// Vista sintética para ScanResultPanel — el visitante de agregador no
/// tiene doc en /users; se muestra nombre/tier que devolvió el partner.
function partnerView(
  v: { externalId?: string; name?: string; tier?: string },
  label: string,
) {
  return {
    id: '',
    branchId: '',
    name: v.name ?? `${label} visitante`,
    photoUrl: '',
    avatar: null,
    membershipStatus: 'ACTIVE' as const,
    membershipPlanId: '',
    memberNumber: v.externalId ?? '',
    membershipUntil: null,
    membershipType: v.tier ? `${label} ${v.tier}` : label,
  };
}
