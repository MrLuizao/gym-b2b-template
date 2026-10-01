import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../utils/db';

const IDLE_LIMIT_MINUTES = 90;
const CONVERSATION_TTL_HOURS = 24;
const CRON_SECRET = process.env.CRON_SECRET ?? '';

/// Libera check-ins >90 min sin salida y barre conversaciones de soporte
/// abandonadas (>72h sin mensajes → se borran con sus mensajes; el plan
/// gratis no permite activar TTL vía API, así que el cron lo hace).
/// Pensado para cron externo (cron-job.org → POST con Authorization:
/// Bearer CRON_SECRET). En dev también lo puede llamar staff autenticado.
export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization') ?? '';
  if (CRON_SECRET && header === `Bearer ${CRON_SECRET}`) {
    // cron externo autorizado
  } else {
    const { requireStaff } = await import('../../utils/staff-auth');
    await requireStaff(event);
  }

  const cutoff = Timestamp.fromMillis(Date.now() - IDLE_LIMIT_MINUTES * 60_000);
  const stale = await db()
    .collection('checkins')
    .where('checked_out', '==', false)
    .where('check_in_at', '<', cutoff)
    .get();

  /// Barrido de conversaciones de soporte abandonadas — mismo criterio
  /// que el campo expires_at (72h desde el último mensaje). Va antes del
  /// early return: corre aunque no haya check-ins stale.
  const convCutoff = Timestamp.fromMillis(
    Date.now() - CONVERSATION_TTL_HOURS * 60 * 60_000,
  );
  const staleConvs = await db()
    .collection('conversations')
    .where('last_message_at', '<', convCutoff)
    .get();

  let conversationsDeleted = 0;
  for (const conv of staleConvs.docs) {
    const msgs = await conv.ref.collection('messages').get();
    const delBatch = db().batch();
    for (const m of msgs.docs) delBatch.delete(m.ref);
    delBatch.delete(conv.ref);
    await delBatch.commit();
    conversationsDeleted++;
  }

  if (stale.empty) {
    return {
      released: 0,
      minutesIdle: IDLE_LIMIT_MINUTES,
      byBranch: {},
      conversationsDeleted,
    };
  }

  const releasedByBranch = new Map<string, number>();
  const batch = db().batch();
  for (const doc of stale.docs) {
    batch.update(doc.ref, {
      checked_out: true,
      checked_out_at: FieldValue.serverTimestamp(),
      release_reason: 'auto_checkout_cron',
    });
    const branchId = String(doc.get('branch_id') ?? '');
    releasedByBranch.set(branchId, (releasedByBranch.get(branchId) ?? 0) + 1);
    const userId = doc.get('user_id');
    if (typeof userId === 'string') {
      batch.update(db().collection('users').doc(userId), {
        active_checkin_id: null,
        active_checkin_branch: null,
      });
    }
  }
  await batch.commit();

  /// Clamp a 0 — si el cierre de día ya reseteó el aforo (o dos
  /// corridas se solapan), el decremento nunca deja la cuenta en
  /// negativo.
  for (const [branchId, count] of releasedByBranch) {
    const ref = db().collection('branches').doc(branchId);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = Number(snap.data()?.current_capacity ?? 0);
      tx.update(ref, { current_capacity: Math.max(0, cur - count) });
    });
  }

  return {
    released: stale.size,
    minutesIdle: IDLE_LIMIT_MINUTES,
    byBranch: Object.fromEntries(releasedByBranch),
    conversationsDeleted,
  };
});
