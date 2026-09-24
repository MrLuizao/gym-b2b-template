/// Barrido manual de una sede — misma lógica que server/utils/close-day.ts
/// pero self-contained para correr con: node --experimental-strip-types
/// scripts/sweep-branch.ts <branchId>
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { useAdmin } from '../server/utils/firebase-admin.ts';

const TZ = 'America/Mexico_City';
const branchId = process.argv[2];
if (!branchId) {
  console.error('Uso: node scripts/sweep-branch.ts <branchId>');
  process.exit(1);
}
const db = useAdmin().db;

const localDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

const localWeekday = (d: Date) =>
  ((new Date(d.toLocaleString('en-US', { timeZone: TZ })).getDay() + 6) % 7) + 1;

function peakCapacity(intervals: { start: number; end: number }[]): number {
  const events = intervals.flatMap((i) => [
    { t: i.start, d: 1 },
    { t: i.end, d: -1 },
  ]);
  events.sort((a, b) => a.t - b.t || b.d - a.d);
  let cur = 0;
  let peak = 0;
  for (const e of events) {
    cur += e.d;
    peak = Math.max(peak, cur);
  }
  return peak;
}

const snap = await db
  .collection('checkins')
  .where('branch_id', '==', branchId)
  .get();
console.log('checkins a barrer:', snap.size);
if (snap.empty) {
  await db.collection('branches').doc(branchId).update({ current_capacity: 0 });
  console.log('aforo reseteado, nada que archivar');
  process.exit(0);
}

const runMs = Date.now();
const buckets = new Map<
  string,
  {
    docs: FirebaseFirestore.QueryDocumentSnapshot[];
    granted: number;
    byMethod: Record<string, number>;
    byPlan: Record<string, number>;
    byHour: number[];
    members: Set<string>;
    intervals: { start: number; end: number }[];
  }
>();

for (const doc of snap.docs) {
  const d = doc.data();
  const inAt = (d.check_in_at as Timestamp | undefined)?.toMillis() ?? runMs;
  const outAt =
    (d.checked_out_at as Timestamp | undefined)?.toMillis() ?? runMs;
  const dateStr = localDate(new Date(inAt));
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

for (const [key, bucket] of buckets) {
  const dateStr = key.split('|')[1] ?? '';
  const weekday = localWeekday(new Date(`${dateStr}T12:00:00`));

  const batch = db.batch();
  batch.set(
    db.collection('dailyStats').doc(`${branchId}_${dateStr}`),
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

  const forecastRef = db.collection('forecasts').doc(branchId);
  const prev =
    ((await forecastRef.get()).data()?.by_weekday as
      | Record<string, number[]>
      | undefined)?.[String(weekday)] ?? new Array<number>(24).fill(0);
  batch.set(
    forecastRef,
    {
      [`by_weekday.${weekday}`]: bucket.byHour.map(
        (v, h) => Math.round((0.8 * (prev[h] ?? 0) + 0.2 * v) * 10) / 10,
      ),
      sample_days: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  for (const doc of bucket.docs) {
    batch.delete(doc.ref);
    const userId = doc.get('user_id');
    if (typeof userId === 'string' && doc.get('checked_out') !== true) {
      batch.update(db.collection('users').doc(userId), {
        active_checkin_id: null,
        active_checkin_branch: null,
      });
    }
  }
  await batch.commit();
  console.log(`${branchId}_${dateStr}:`, bucket.docs.length, 'docs');
}

await db.collection('branches').doc(branchId).update({ current_capacity: 0 });
const left = await db
  .collection('checkins')
  .where('branch_id', '==', branchId)
  .get();
console.log(
  'checkins restantes:',
  left.size,
  '| cap:',
  (await db.collection('branches').doc(branchId).get()).data()?.current_capacity,
);
process.exit(0);
