import { Timestamp } from 'firebase-admin/firestore';

import type { CheckInsReport } from '#shared/types';

import { db, toCheckIn } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

const TZ = 'America/Mexico_City';

function localDateStr(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/// Los check-ins son efímeros (se borran al cierre). El detalle tabla
/// solo existe para "hoy"; la historia de los stats viene de dailyStats.
export default defineEventHandler(async (event): Promise<CheckInsReport> => {
  const staff = await requireStaff(event);
  const query = getQuery(event);

  const from = typeof query.from === 'string' ? Number(query.from) : null;
  const to = typeof query.to === 'string' ? Number(query.to) : null;
  const branchId =
    staff.role !== 'ADMIN'
      ? staff.branchId
      : typeof query.branchId === 'string' && query.branchId !== 'todas'
        ? query.branchId
        : null;

  /// Detalle: solo hay docs vivos de hoy (TTL). Se devuelven si el rango
  /// toca el día actual.
  const todayStr = localDateStr(Date.now());
  const rangeIncludesToday =
    (from === null || from <= Date.now()) && (to === null || to >= Date.now() - 86_400_000);

  let checkIns = [] as ReturnType<typeof toCheckIn>[];
  if (rangeIncludesToday) {
    let ref = db()
      .collection('checkins')
      .orderBy('check_in_at', 'desc') as FirebaseFirestore.Query;
    if (branchId) ref = ref.where('branch_id', '==', branchId);
    if (from !== null) ref = ref.where('check_in_at', '>=', Timestamp.fromMillis(from));
    if (to !== null) ref = ref.where('check_in_at', '<=', Timestamp.fromMillis(to));
    checkIns = (await ref.limit(200).get()).docs.map(toCheckIn);
  }

  /// Stats históricos: dailyStats por sede/día en el rango.
  const fromStr = localDateStr(from ?? Date.now() - 30 * 86_400_000);
  const toStr = localDateStr(to ?? Date.now());
  let statsQuery = db().collection('dailyStats') as FirebaseFirestore.Query;
  if (branchId) statsQuery = statsQuery.where('branch_id', '==', branchId);
  statsQuery = statsQuery
    .where('date', '>=', fromStr)
    .where('date', '<=', toStr);
  const statsSnap = await statsQuery.get();

  let total = 0;
  let granted = 0;
  let denied = 0;
  let uniqueMembers = 0;
  const byBranchMap = new Map<string, number>();
  for (const doc of statsSnap.docs) {
    const d = doc.data();
    total += Number(d.total ?? 0);
    granted += Number(d.granted ?? 0);
    denied += Number(d.denied ?? 0);
    uniqueMembers += Number(d.unique_members ?? 0);
    const bid = String(d.branch_id ?? '');
    byBranchMap.set(bid, (byBranchMap.get(bid) ?? 0) + Number(d.total ?? 0));
  }

  /// Hoy aún no está agregado en dailyStats — sumar lo vivo.
  const liveGranted = checkIns.filter((c) => c.granted).length;
  total += checkIns.length;
  granted += liveGranted;
  denied += checkIns.length - liveGranted;
  for (const c of checkIns) {
    if (!statsSnap.docs.some((d) => d.get('date') === todayStr && d.get('branch_id') === c.branchId)) {
      byBranchMap.set(c.branchId, (byBranchMap.get(c.branchId) ?? 0) + 1);
    }
  }

  return {
    checkIns,
    stats: {
      total,
      granted,
      denied,
      uniqueMembers,
      byBranch: [...byBranchMap.entries()]
        .map(([id, count]) => ({ branchId: id, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
});
