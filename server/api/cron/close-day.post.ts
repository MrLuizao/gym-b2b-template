import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../utils/db';

const TZ = 'America/Mexico_City';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

function localDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/// Día de semana local 1..7 (lunes..domingo) para by_weekday.
function localWeekday(date: Date): number {
  const day = new Date(
    date.toLocaleString('en-US', { timeZone: TZ }),
  ).getDay();
  return ((day + 6) % 7) + 1;
}

/// Pico de aforo: sweep line sobre intervalos entrada→salida.
function peakCapacity(intervals: { start: number; end: number }[]): number {
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

interface DayBucket {
  docs: FirebaseFirestore.QueryDocumentSnapshot[];
  granted: number;
  byMethod: Record<string, number>;
  byPlan: Record<string, number>;
  byHour: number[];
  members: Set<string>;
  intervals: { start: number; end: number }[];
}

/// Cierre de día: barre TODOS los check-ins vivos y los agrega en
/// dailyStats agrupados por su propia fecha — robusto ante la ventana
/// flexible de 1h de Vercel Hobby (puede correr ya pasada medianoche).
/// Programar ~23:55 CDMX (Vercel cron: 55 5 * * * UTC).
export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization') ?? '';
  if (CRON_SECRET && header === `Bearer ${CRON_SECRET}`) {
    // cron externo autorizado
  } else {
    const { requireStaff, requireAdmin } = await import(
      '../../utils/staff-auth'
    );
    requireAdmin(await requireStaff(event));
  }

  const snap = await db().collection('checkins').get();
  const branches = await db().collection('branches').get();
  const runMs = Date.now();

  /// Agrupar por (branch_id, fecha local del check_in).
  const buckets = new Map<string, DayBucket>();
  for (const doc of snap.docs) {
    const d = doc.data();
    const inAt = (d.check_in_at as Timestamp | undefined)?.toMillis() ?? runMs;
    const outAt =
      (d.checked_out_at as Timestamp | undefined)?.toMillis() ?? runMs;
    const branchId = String(d.branch_id ?? '');
    const dateStr = localDateString(new Date(inAt));
    const key = `${branchId}|${dateStr}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        docs: [],
        granted: 0,
        byMethod: {},
        byPlan: {},
        byHour: new Array<number>(24).fill(0),
        members: new Set(),
        intervals: [],
      };
      buckets.set(key, bucket);
    }
    bucket.docs.push(doc);

    if (d.granted === true) {
      bucket.granted++;
      bucket.members.add(String(d.user_id));
      const hour = new Date(
        new Date(inAt).toLocaleString('en-US', { timeZone: TZ }),
      ).getHours();
      bucket.byHour[hour] = (bucket.byHour[hour] ?? 0) + 1;
      const m = String(d.method ?? 'qr');
      bucket.byMethod[m] = (bucket.byMethod[m] ?? 0) + 1;
      const p = String(d.membership_plan_id ?? '');
      if (p) bucket.byPlan[p] = (bucket.byPlan[p] ?? 0) + 1;
      bucket.intervals.push({ start: inAt, end: outAt });
    }
  }

  const results: Record<string, { total: number; granted: number }> = {};

  for (const [key, bucket] of buckets) {
    const [branchId = '', dateStr = ''] = key.split('|');
    const weekday = localWeekday(new Date(`${dateStr}T12:00:00`));

    const batch = db().batch();
    batch.set(
      db().collection('dailyStats').doc(`${branchId}_${dateStr}`),
      {
        branch_id: branchId,
        date: dateStr,
        total: bucket.docs.length,
        granted: bucket.granted,
        denied: bucket.docs.length - bucket.granted,
        by_method: bucket.byMethod,
        by_plan: bucket.byPlan,
        by_hour: bucket.byHour,
        peak_capacity: peakCapacity(bucket.intervals),
        unique_members: bucket.members.size,
      },
      { merge: true },
    );

    /// Pronóstico: EMA del by_hour de ese día en su día de semana.
    const forecastRef = db().collection('forecasts').doc(branchId);
    const forecastSnap = await forecastRef.get();
    const prev = forecastSnap.data() ?? {};
    const prevWeekday =
      ((prev.by_weekday as Record<string, number[]> | undefined) ?? {})[
        String(weekday)
      ] ?? new Array<number>(24).fill(0);
    const merged = bucket.byHour.map(
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

    /// Barrido + punteros activos.
    for (const doc of bucket.docs) {
      batch.delete(doc.ref);
      const userId = doc.get('user_id');
      if (typeof userId === 'string' && doc.get('checked_out') !== true) {
        batch.update(db().collection('users').doc(userId), {
          active_checkin_id: null,
          active_checkin_branch: null,
        });
      }
    }

    await batch.commit();
    results[`${branchId}_${dateStr}`] = {
      total: bucket.docs.length,
      granted: bucket.granted,
    };
  }

  /// Reset de aforo en todas las sedes.
  for (const branchDoc of branches.docs) {
    await branchDoc.ref.update({ current_capacity: 0 });
  }

  return { swept: snap.size, days: results };
});
