import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../../utils/db';
import { requireMember } from '../../utils/member-auth';
import { rateLimit } from '../../utils/rate-limit';

/// Validez del código de canje una vez emitido.
const REDEMPTION_TTL_DAYS = 30;

function redemptionCode(): string {
  return `RWR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/// POST /api/rewards/redeem — el socio canjea una recompensa con sus
/// puntos. Deducción + registro en transacción para no canjear dos
/// veces con el mismo saldo.
export default defineEventHandler(async (event) => {
  const member = await requireMember(event);
  await rateLimit(`redeem:${member.id}`, 10, 60_000);
  const body = await readBody<{ rewardId?: string }>(event);
  const rewardId = body?.rewardId ?? '';
  if (!rewardId) {
    throw createError({ statusCode: 400, message: 'rewardId requerido' });
  }

  const userRef = db().collection('users').doc(member.id);
  const rewardRef = db().collection('rewards').doc(rewardId);
  const redemptionRef = userRef.collection('redemptions').doc();

  const result = await db().runTransaction(async (tx) => {
    const [userDoc, rewardDoc] = await Promise.all([
      tx.get(userRef),
      tx.get(rewardRef),
    ]);
    if (!rewardDoc.exists || rewardDoc.get('active') !== true) {
      throw createError({ statusCode: 404, message: 'Recompensa no disponible' });
    }
    const cost = Number(rewardDoc.get('points_cost') ?? 0);
    const balance = Number(userDoc.get('points') ?? 0);
    if (balance < cost) {
      throw createError({ statusCode: 409, message: 'Puntos insuficientes' });
    }

    const expiresAt = new Date(Date.now() + REDEMPTION_TTL_DAYS * 86_400_000);
    const code = redemptionCode();
    tx.set(redemptionRef, {
      reward_id: rewardId,
      reward_name: String(rewardDoc.get('name') ?? ''),
      points_spent: cost,
      member_id: member.id,
      member_name: member.name,
      branch_id: member.branchId,
      code,
      status: 'active',
      created_at: FieldValue.serverTimestamp(),
      expires_at: expiresAt,
      used_at: null,
    });
    tx.update(userRef, { points: FieldValue.increment(-cost) });
    return { code, points: balance - cost };
  });

  return {
    id: redemptionRef.id,
    code: result.code,
    points: result.points,
    expiresInDays: REDEMPTION_TTL_DAYS,
  };
});
