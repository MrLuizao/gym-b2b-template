import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import {
  BRAND_TIMEZONE,
  IDLE_LIMIT_MINUTES,
  db,
  localDateString,
} from './utils';

/// Libera check-ins que llevan >90 min sin salida — auto checkout.
export const autoCheckoutCron = onSchedule('every 15 minutes', async () => {
  const cutoff = Timestamp.fromMillis(
    Date.now() - IDLE_LIMIT_MINUTES * 60_000,
  );

  const stale = await db
    .collection('checkins')
    .where('checked_out', '==', false)
    .where('check_in_at', '<', cutoff)
    .get();

  if (stale.empty) return;

  const releasedByBranch = new Map<string, number>();
  const batch = db.batch();

  stale.forEach((doc) => {
    batch.update(doc.ref, {
      checked_out: true,
      checked_out_at: FieldValue.serverTimestamp(),
      release_reason: 'auto_checkout_cron',
    });
    const branchId = String(doc.get('branch_id') ?? '');
    releasedByBranch.set(branchId, (releasedByBranch.get(branchId) ?? 0) + 1);
    const userId = doc.get('user_id');
    if (typeof userId === 'string') {
      batch.update(db.collection('users').doc(userId), {
        active_checkin_id: null,
        active_checkin_branch: null,
      });
    }
  });
  await batch.commit();

  for (const [branchId, count] of releasedByBranch) {
    await db
      .collection('branches')
      .doc(branchId)
      .update({ current_capacity: FieldValue.increment(-count) });
  }
});

/// Pico de aforo del día: sweep line sobre intervalos entrada→salida.
function peakCapacity(
  intervals: { start: number; end: number }[],
): number {
  const events: { t: number; d: number }[] = [];
  for (const i of intervals) {
    events.push({ t: i.start, d: 1 }, { t: i.end, d: -1 });
  }
  events.sort((a, b) => a.t - b.t || b.d - a.d);
  let cur = 0;
  let peak = 0;
  for (const e of events) {
    cur += e.d;
    peak = Math.max(peak, cur);
  }
  return peak;
}

/// Cierre de día por sede: agrega dailyStats, actualiza el pronóstico
/// (EMA por día de semana), resetea aforo y barre check-ins.
/// El TTL de expires_at respalda el borrado si esto falla.
export const closeDay = onSchedule(
  { schedule: '55 23 * * *', timeZone: BRAND_TIMEZONE },
  async () => {
    const branches = await db.collection('branches').get();
    const dateStr = localDateString();
    /// Día de semana local 1..7 (lunes..domingo) para by_weekday.
    const weekday = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: BRAND_TIMEZONE,
        weekday: 'short',
      })
        .format(new Date())
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .replace('Mon', '1')
        .replace('Tue', '2')
        .replace('Wed', '3')
        .replace('Thu', '4')
        .replace('Fri', '5')
        .replace('Sat', '6')
        .replace('Sun', '7') || '0',
    );

    const dayStart = new Date(`${dateStr}T00:00:00-06:00`).getTime();
    const dayEnd = dayStart + 86_400_000;

    for (const branchDoc of branches.docs) {
      const branchId = branchDoc.id;
      const snap = await db
        .collection('checkins')
        .where('branch_id', '==', branchId)
        .where('check_in_at', '>=', Timestamp.fromMillis(dayStart))
        .where('check_in_at', '<', Timestamp.fromMillis(dayEnd))
        .get();

      if (snap.empty) {
        await branchDoc.ref.update({ current_capacity: 0 });
        continue;
      }

      let granted = 0;
      const byMethod: Record<string, number> = {};
      const byPlan: Record<string, number> = {};
      const byHour = new Array<number>(24).fill(0);
      const members = new Set<string>();
      const intervals: { start: number; end: number }[] = [];

      for (const doc of snap.docs) {
        const d = doc.data();
        const inAt =
          (d.check_in_at as Timestamp | undefined)?.toMillis() ?? dayStart;
        const outAt =
          (d.checked_out_at as Timestamp | undefined)?.toMillis() ?? dayEnd;

        if (d.granted === true) {
          granted++;
          members.add(String(d.user_id));
          const hour = new Date(
            new Date(inAt).toLocaleString('en-US', {
              timeZone: BRAND_TIMEZONE,
            }),
          ).getHours();
          byHour[hour] = (byHour[hour] ?? 0) + 1;
          const m = String(d.method ?? 'qr');
          byMethod[m] = (byMethod[m] ?? 0) + 1;
          const p = String(d.membership_plan_id ?? '');
          if (p) byPlan[p] = (byPlan[p] ?? 0) + 1;
          intervals.push({ start: inAt, end: outAt });
        }
      }

      const statRef = db.collection('dailyStats').doc(`${branchId}_${dateStr}`);
      const batch = db.batch();
      batch.set(statRef, {
        branch_id: branchId,
        date: dateStr,
        total: snap.size,
        granted,
        denied: snap.size - granted,
        by_method: byMethod,
        by_plan: byPlan,
        by_hour: byHour,
        peak_capacity: peakCapacity(intervals),
        unique_members: members.size,
      });

      /// Pronóstico: EMA del by_hour de hoy en su día de semana.
      const forecastRef = db.collection('forecasts').doc(branchId);
      const forecastSnap = await forecastRef.get();
      const prev = forecastSnap.data() ?? {};
      const prevWeekday =
        ((prev.by_weekday as Record<string, number[]> | undefined) ?? {})[
          String(weekday)
        ] ?? new Array<number>(24).fill(0);
      const merged = byHour.map(
        (v, h) => Math.round((0.8 * (prevWeekday[h] ?? 0) + 0.2 * v) * 10) / 10,
      );
      batch.set(
        forecastRef,
        {
          [`by_weekday.${weekday}`]: merged,
          sample_days: FieldValue.increment(1),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      /// Reset de aforo y barrido de check-ins del día.
      batch.update(branchDoc.ref, { current_capacity: 0 });
      for (const doc of snap.docs) batch.delete(doc.ref);

      /// Limpiar punteros activos de socios que quedaron adentro.
      for (const doc of snap.docs) {
        const userId = doc.get('user_id');
        if (typeof userId === 'string' && doc.get('checked_out') !== true) {
          batch.update(db.collection('users').doc(userId), {
            active_checkin_id: null,
            active_checkin_branch: null,
          });
        }
      }

      await batch.commit();
    }
  },
);
