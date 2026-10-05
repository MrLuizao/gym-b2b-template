import { FieldPath, FieldValue } from 'firebase-admin/firestore';

import { db } from './db';

const TZ = 'America/Mexico_City';

/// Puntos que gana el socio al cumplir su meta semanal de asistencias.
export const GOAL_BONUS_POINTS = 50;

/// Semana en CDMX con inicio en lunes. `key` = fecha del lunes (única por
/// semana, sirve para "ya premiado esta semana").
export function weekBounds(now = new Date()): {
  monday: string;
  sunday: string;
  today: string;
  weekKey: string;
} {
  const local = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const dow = (local.getDay() + 6) % 7; // 0 = lunes
  const mon = new Date(local);
  mon.setDate(local.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  const monday = key(mon);
  return { monday, sunday: key(sun), today: key(local), weekKey: monday };
}

/// Registra la visita del día (`users/{id}/visits/{yyyy-mm-dd}`) y premia
/// con GOAL_BONUS_POINTS si el socio alcanzó su meta semanal — una sola
/// vez por semana (`goal_awarded_week` lo marca). Transacción para no
/// duplicar el premio ni la visita.
export async function recordVisitAndReward(
  userId: string,
  branchId: string,
  checkinId: string,
): Promise<void> {
  const { monday, sunday, today, weekKey } = weekBounds();
  const userRef = db().collection('users').doc(userId);
  const visitsCol = userRef.collection('visits');
  const visitRef = visitsCol.doc(today);

  await db().runTransaction(async (tx) => {
    const [userDoc, visitDoc, weekSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(visitRef),
      tx.get(
        visitsCol
          .where(FieldPath.documentId(), '>=', monday)
          .where(FieldPath.documentId(), '<=', sunday),
      ),
    ]);

    if (!visitDoc.exists) {
      tx.set(visitRef, {
        branch_id: branchId,
        checkin_id: checkinId,
        at: FieldValue.serverTimestamp(),
      });
    }

    const data = userDoc.data() ?? {};
    const goal = Number(data.weekly_goal ?? 4);
    if (
      goal > 0 &&
      data.goal_awarded_week !== weekKey &&
      weekSnap.size + (visitDoc.exists ? 0 : 1) >= goal
    ) {
      tx.update(userRef, {
        points: FieldValue.increment(GOAL_BONUS_POINTS),
        goal_awarded_week: weekKey,
        goal_awarded_at: FieldValue.serverTimestamp(),
      });
    }
  });
}
