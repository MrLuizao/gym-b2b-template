import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../../utils/db';
import { useAdmin } from '../../utils/firebase-admin';
import { requireMember } from '../../utils/member-auth';
import { recordPointsHistory } from '../../utils/points-history';
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

    const rewardData = rewardDoc.data()!;
    const cost = Number(rewardData.points_cost ?? 0);
    const balance = Number(userDoc.get('points') ?? 0);
    const rewardName = String(rewardData.name ?? '');

    if (balance < cost) {
      throw createError({ statusCode: 409, message: 'Puntos insuficientes' });
    }

    /// Validar stock si está configurado.
    const stock = rewardData.stock as number | null | undefined;
    const redeemedCount = Number(rewardData.redeemed_count ?? 0);
    if (stock != null && redeemedCount >= stock) {
      throw createError({ statusCode: 409, message: 'Recompensa agotada' });
    }

    const expiresAt = new Date(Date.now() + REDEMPTION_TTL_DAYS * 86_400_000);
    const code = redemptionCode();
    const newBalance = balance - cost;

    tx.set(redemptionRef, {
      reward_id: rewardId,
      reward_name: rewardName,
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

    /// Incrementar contador de canjes en la recompensa.
    tx.update(rewardRef, { redeemed_count: FieldValue.increment(1) });

    /// Registrar en historial de puntos.
    recordPointsHistory(tx, member.id, {
      type: 'redeem',
      delta: -cost,
      balance: newBalance,
      description: `Canje: ${rewardName}`,
      refId: redemptionRef.id,
    });

    return { code, points: newBalance, rewardName };
  });

  /// Push de confirmación al socio — best-effort.
  try {
    await useAdmin().messaging.send({
      topic: `member_${member.id}`,
      notification: {
        title: '¡Recompensa canjeada!',
        body: `Tu código ${result.code} es válido por ${REDEMPTION_TTL_DAYS} días — muéstralo en recepción`,
      },
      data: { type: 'loyalty', code: result.code },
    });
  } catch {
    // Push best-effort — el canje ya quedó en Firestore.
  }

  return {
    id: redemptionRef.id,
    code: result.code,
    points: result.points,
    expiresInDays: REDEMPTION_TTL_DAYS,
  };
});
