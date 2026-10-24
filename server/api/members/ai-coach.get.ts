import { FieldPath, type Timestamp } from 'firebase-admin/firestore';
import type { MemberAiCoachResponse } from '#shared/types';
import { db } from '../../utils/db';
import { generateMemberCoachTip } from '../../utils/gemini';
import { weekBounds } from '../../utils/loyalty';
import { requireMember } from '../../utils/member-auth';

const TZ = 'America/Mexico_City';

function formatHourLabel(h: number): string {
  const clamped = Math.min(23, Math.max(0, h));
  return `${String(clamped).padStart(2, '0')}:00`;
}

/**
 * GET /api/members/ai-coach
 * Endpoint para la App del Socio (`rirhub-app`):
 * 1. Cruza la hora habitual del socio con el `forecasts/{branchId}` del día actual
 *    para recomendarle la ventana horaria con menor saturación.
 * 2. Evalúa su meta semanal (`weekly_goal`) contra su promedio real y racha para
 *    proponer un ajuste inteligente de hábito (1-tap).
 * 3. Genera un consejo motivacional con Google Gemini (cacheado por día en el doc del socio).
 */
export default defineEventHandler(async (event): Promise<MemberAiCoachResponse> => {
  const memberCtx = await requireMember(event);
  const { monday, sunday, today } = weekBounds();

  const userRef = db().collection('users').doc(memberCtx.id);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  const currentGoal = Math.min(6, Math.max(2, Number(userData.weekly_goal ?? 4)));

  // Si ya existe caché del día de hoy con la misma meta semanal, devolver instantáneo
  const cached = userData.ai_coach_cache as
    | (MemberAiCoachResponse & { cachedGoal?: number })
    | undefined;
  if (
    cached &&
    cached.generatedDate === today &&
    cached.cachedGoal === currentGoal &&
    cached.coachTip
  ) {
    return cached;
  }

  const branchId = String(userData.branch_id || memberCtx.branchId || '');
  const [branchSnap, forecastSnap, weekVisitsSnap] = await Promise.all([
    branchId ? db().collection('branches').doc(branchId).get() : Promise.resolve(null),
    branchId ? db().collection('forecasts').doc(branchId).get() : Promise.resolve(null),
    userRef
      .collection('visits')
      .where(FieldPath.documentId(), '>=', monday)
      .where(FieldPath.documentId(), '<=', sunday)
      .get(),
  ]);

  const branchData = branchSnap?.data() ?? {};
  const branchName = String(branchData.name ?? 'tu sede');
  const maxCapacity = Math.max(20, Number(branchData.max_capacity ?? 80));

  // Determinar hora habitual del socio (en CDMX) a partir de su último check-in
  let usualHour = 18; // Default 18:00 hrs (hora pico vespertina)
  const lastCheckinTs = userData.last_checkin_at as Timestamp | undefined;
  if (lastCheckinTs?.toDate) {
    const localCheckin = new Date(
      lastCheckinTs.toDate().toLocaleString('en-US', { timeZone: TZ }),
    );
    const h = localCheckin.getHours();
    if (h >= 6 && h <= 22) {
      usualHour = h;
    }
  }

  // Obtener curva horaria del día de la semana actual en CDMX
  const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const weekdayKey = String(((localNow.getDay() + 6) % 7) + 1); // 1=Lun .. 7=Dom
  const byWeekday = (forecastSnap?.data()?.by_weekday as Record<string, number[]>) ?? {};
  const hourlyCurve = byWeekday[weekdayKey] ?? [];

  const occupancyPctAt = (h: number): number => {
    const rawCount = Number(hourlyCurve[h] ?? 0);
    if (rawCount > 0) {
      return Math.min(98, Math.max(12, Math.round((rawCount / maxCapacity) * 100)));
    }
    // Curva típica de respaldo cuando aún no hay histórico suficiente en esa hora
    const fallbackProfile: Record<number, number> = {
      6: 42,
      7: 58,
      8: 64,
      9: 52,
      10: 38,
      11: 32,
      12: 30,
      13: 28,
      14: 26,
      15: 34,
      16: 44,
      17: 62,
      18: 84,
      19: 91,
      20: 78,
      21: 50,
    };
    return fallbackProfile[h] ?? 45;
  };

  const usualHourOccupancyPct = occupancyPctAt(usualHour);

  // Buscar la mejor hora cercana (±2 horas dentro de 06:00 a 21:00) con menor saturación
  const candidateHours: number[] = [];
  for (let delta = -2; delta <= 2; delta++) {
    const h = usualHour + delta;
    if (h >= 6 && h <= 21) {
      candidateHours.push(h);
    }
  }

  let bestHour = usualHour;
  let bestHourOccupancyPct = usualHourOccupancyPct;
  for (const h of candidateHours) {
    const occ = occupancyPctAt(h);
    if (occ < bestHourOccupancyPct) {
      bestHour = h;
      bestHourOccupancyPct = occ;
    }
  }

  // Si la hora habitual ya era muy baja y igualó, ofrecer ventana de 1h
  const bestHourWindow = `${formatHourLabel(bestHour)} - ${formatHourLabel(bestHour + 1)}`;
  const usualHourLabel = formatHourLabel(usualHour);

  // Evaluar hábito semanal y meta sugerida
  const feat = (userData.latest_churn_features ?? {}) as Record<string, unknown>;
  const avgVisits = Number(feat.avg_visits_per_week_last_4 ?? weekVisitsSnap.size);
  const streak = Number(userData.goal_streak ?? 0);
  const visitsThisWeek = weekVisitsSnap.size;

  let suggestedGoal: number | null = null;
  let habitReason: string | null = null;

  if (currentGoal >= 4 && avgVisits > 0 && avgVisits <= currentGoal - 1.3 && streak === 0) {
    suggestedGoal = Math.max(2, currentGoal - 1);
    habitReason = `Tu promedio reciente es de ${avgVisits.toFixed(1)} visitas/sem. Bajar temporalmente tu meta a ${suggestedGoal} días te ayudará a asegurar el bono de +50 pts y reconstruir tu racha.`;
  } else if (streak >= 3 && avgVisits >= currentGoal && currentGoal < 6) {
    suggestedGoal = currentGoal + 1;
    habitReason = `¡Llevas ${streak} semanas seguidas cumpliendo tu meta! Estás listo para subir tu objetivo a ${suggestedGoal} días por semana.`;
  }

  const generatedTip = await generateMemberCoachTip({
    memberName: String(userData.name ?? memberCtx.name ?? 'Atleta'),
    branchName,
    bestHourWindow,
    bestHourOccupancyPct,
    usualHourLabel,
    usualHourOccupancyPct,
    currentGoal,
    suggestedGoal,
    visitsThisWeek,
    streak,
  });

  const response: MemberAiCoachResponse = {
    bestHour,
    bestHourWindow,
    bestHourOccupancyPct,
    usualHour,
    usualHourLabel,
    usualHourOccupancyPct,
    branchName,
    currentGoal,
    suggestedGoal,
    habitReason,
    coachTip: generatedTip.tip,
    aiPowered: generatedTip.aiPowered,
    generatedDate: today,
  };

  try {
    await userRef.update({
      ai_coach_cache: {
        ...response,
        cachedGoal: currentGoal,
      },
    });
  } catch {
    // No bloquear la respuesta si falla guardar caché
  }

  return response;
});
