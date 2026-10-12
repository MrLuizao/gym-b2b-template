import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../../utils/db';
import { useAdmin } from '../../utils/firebase-admin';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

/// Días antes de expirar para enviar el recordatorio.
const REMINDER_DAYS_BEFORE = 3;

/// GET /api/cron/redemption-reminder — envía push a socios con códigos
/// de canje que expiran en los próximos 3 días. Corre diario.
export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization') ?? '';
  if (CRON_SECRET && header === `Bearer ${CRON_SECRET}`) {
    // cron autorizado
  } else {
    const { requireStaff } = await import('../../utils/staff-auth');
    const staff = await requireStaff(event);
    if (staff.role !== 'ADMIN') {
      throw createError({ statusCode: 403, message: 'Solo admin' });
    }
  }

  const now = Date.now();
  const reminderStart = Timestamp.fromMillis(now);
  const reminderEnd = Timestamp.fromMillis(
    now + REMINDER_DAYS_BEFORE * 24 * 60 * 60_000,
  );

  /// Buscar códigos activos que expiran en los próximos 3 días y no han
  /// recibido recordatorio.
  const snap = await db()
    .collectionGroup('redemptions')
    .where('status', '==', 'active')
    .where('expires_at', '>=', reminderStart)
    .where('expires_at', '<=', reminderEnd)
    .get();

  let sent = 0;
  const messaging = useAdmin().messaging;

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.reminder_sent) continue;

    const memberId = String(d.member_id ?? '');
    const code = String(d.code ?? '');
    const rewardName = String(d.reward_name ?? '');
    const expiresAt = d.expires_at?.toDate?.() ?? new Date(d.expires_at);
    const daysLeft = Math.ceil(
      (expiresAt.getTime() - now) / (24 * 60 * 60_000),
    );

    try {
      await messaging.send({
        topic: `member_${memberId}`,
        notification: {
          title: '¡Tu código está por expirar!',
          body: `${rewardName} (${code}) vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'} — muéstralo en recepción`,
        },
        data: { type: 'loyalty', code },
      });
      await doc.ref.update({ reminder_sent: true });
      sent++;
    } catch {
      // Push best-effort — continuar con los demás.
    }
  }

  return { checked: snap.size, sent };
});
