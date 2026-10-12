import { FieldPath, FieldValue } from 'firebase-admin/firestore';

import { db } from './db';
import { useAdmin } from './firebase-admin';
import { recordPointsHistory } from './points-history';

const TZ = 'America/Mexico_City';

/// Puntos que gana el socio al cumplir su meta semanal de asistencias.
export const GOAL_BONUS_POINTS = 50;

/// Bonos por racha de semanas consecutivas cumpliendo la meta.
/// Clave = semanas consecutivas, valor = puntos extra.
export const STREAK_BONUSES: Record<number, number> = {
  2: 25, // 2 semanas seguidas → +25 pts extra
  4: 50, // 4 semanas seguidas → +50 pts extra
  8: 100, // 8 semanas seguidas → +100 pts extra
  12: 150, // 12 semanas seguidas → +150 pts extra
};

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
/// duplicar el premio ni la visita. Al premiar, dispara push FCM al
/// topic personal del socio (`data.type='loyalty'` → la app abre
/// Recompensas al tocarla).
export async function recordVisitAndReward(
  userId: string,
  branchId: string,
  checkinId: string,
): Promise<void> {
  const { monday, sunday, today, weekKey } = weekBounds();
  const userRef = db().collection('users').doc(userId);
  const visitsCol = userRef.collection('visits');
  const visitRef = visitsCol.doc(today);

  const awarded = await db().runTransaction(async (tx) => {
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
    const award =
      goal > 0 &&
      data.goal_awarded_week !== weekKey &&
      weekSnap.size + (visitDoc.exists ? 0 : 1) >= goal;
    if (award) {
      const currentPoints = Number(data.points ?? 0);
      const prevStreak = Number(data.goal_streak ?? 0);
      const prevStreakWeek = String(data.goal_streak_week ?? '');

      /// Calcular si la racha continúa (la semana anterior fue premiada).
      const lastMonday = new Date(
        new Date(monday).getTime() - 7 * 24 * 60 * 60_000,
      );
      const lastWeekKey = `${lastMonday.getFullYear()}-${String(lastMonday.getMonth() + 1).padStart(2, '0')}-${String(lastMonday.getDate()).padStart(2, '0')}`;
      const streakContinues = prevStreakWeek === lastWeekKey;
      const newStreak = streakContinues ? prevStreak + 1 : 1;

      /// Verificar si hay bono por racha.
      const streakBonus = STREAK_BONUSES[newStreak] ?? 0;
      const totalBonus = GOAL_BONUS_POINTS + streakBonus;
      const newBalance = currentPoints + totalBonus;

      tx.update(userRef, {
        points: FieldValue.increment(totalBonus),
        points_earned: FieldValue.increment(totalBonus),
        goal_awarded_week: weekKey,
        goal_awarded_at: FieldValue.serverTimestamp(),
        goal_streak: newStreak,
        goal_streak_week: weekKey,
      });

      recordPointsHistory(tx, userId, {
        type: 'weekly_goal',
        delta: GOAL_BONUS_POINTS,
        balance: currentPoints + GOAL_BONUS_POINTS,
        description: `Meta semanal cumplida (${goal} visitas)`,
      });

      if (streakBonus > 0) {
        recordPointsHistory(tx, userId, {
          type: 'streak_bonus',
          delta: streakBonus,
          balance: newBalance,
          description: `Bono por ${newStreak} semanas de racha`,
        });
      }

      return { awarded: true, streak: newStreak, streakBonus };
    }
    return { awarded: false, streak: 0, streakBonus: 0 };
  });

  if (awarded.awarded) {
    try {
      const totalPts = GOAL_BONUS_POINTS + awarded.streakBonus;
      const streakMsg =
        awarded.streakBonus > 0
          ? ` (+${awarded.streakBonus} bono por ${awarded.streak} semanas de racha)`
          : '';
      await useAdmin().messaging.send({
        topic: `member_${userId}`,
        notification: {
          title: '¡Meta semanal cumplida!',
          body: `Ganaste ${totalPts} puntos${streakMsg} — canjéalos por recompensas`,
        },
        data: { type: 'loyalty' },
      });
    } catch {
      /// Push best-effort — el premio ya quedó en Firestore.
    }
  }
}
