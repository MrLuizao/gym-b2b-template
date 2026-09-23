import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../utils/db';

const IDLE_LIMIT_MINUTES = 90;
const CRON_SECRET = process.env.CRON_SECRET ?? '';

/// Libera check-ins >90 min sin salida. Pensado para cron externo
/// (cron-job.org → POST con Authorization: Bearer CRON_SECRET).
/// En dev también lo puede llamar staff autenticado.
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

  if (stale.empty) {
    return { released: 0, minutesIdle: IDLE_LIMIT_MINUTES, byBranch: {} };
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

  for (const [branchId, count] of releasedByBranch) {
    await db()
      .collection('branches')
      .doc(branchId)
      .update({ current_capacity: FieldValue.increment(-count) });
  }

  return {
    released: stale.size,
    minutesIdle: IDLE_LIMIT_MINUTES,
    byBranch: Object.fromEntries(releasedByBranch),
  };
});
