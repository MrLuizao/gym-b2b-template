/// Riesgo de queja (chat de soporte) → riesgo de churn combinado.
///
/// - `users.complaint_risk` (0-1) se guarda con su sello `last_complaint_at`
///   (ISO). Decae con vida media de 14 días: el valor "vivo" se calcula al
///   leer, nunca se reescribe solo por pasar el tiempo.
/// - Cada queja suma `severity * COMPLAINT_INCREMENT` sobre el valor ya
///   decaído (tope 1). Mensajes sin queja no tocan los campos.
/// - `combined_risk = 0.7 * churn_risk_ml + 0.3 * complaint_risk_decaído`;
///   el nivel usa los mismos umbrales del modelo.

import { type ChurnRiskLevel, COMPLAINT_LABELS } from '#shared/types';

import { CHURN_THRESHOLDS } from './churn-model';
import { db } from './db';
import { analyzeSentiment, type ComplaintType } from './sentiment-analysis';

export const COMPLAINT_HALF_LIFE_DAYS = 14;
export const COMPLAINT_INCREMENT = 0.5;
export const COMPLAINT_WEIGHT = 0.3;
/// Por debajo de esto la queja ya no se considera "pendiente".
export const COMPLAINT_ACTIVE_THRESHOLD = 0.3;

/// Valor vivo del riesgo de queja aplicando el decaimiento exponencial.
export function decayedComplaintRisk(
  risk: unknown,
  lastAt: unknown,
  nowMs: number = Date.now(),
): number {
  const r = typeof risk === 'number' && Number.isFinite(risk) ? risk : 0;
  if (r <= 0) return 0;
  const atMs = typeof lastAt === 'string' ? Date.parse(lastAt) : Number.NaN;
  if (!Number.isFinite(atMs)) return r;
  const days = Math.max(0, (nowMs - atMs) / 86_400_000);
  return r * 0.5 ** (days / COMPLAINT_HALF_LIFE_DAYS);
}

export function riskLevelFor(probability: number): ChurnRiskLevel {
  if (probability >= CHURN_THRESHOLDS.high) return 'high';
  if (probability >= CHURN_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/// Combina probabilidad ML con el riesgo de queja ya decaído.
export function combineChurnRisk(
  mlProbability: number,
  complaintRisk: number,
): { combined: number; level: ChurnRiskLevel } {
  const combined = Math.min(
    Math.max(mlProbability * (1 - COMPLAINT_WEIGHT) + complaintRisk * COMPLAINT_WEIGHT, 0),
    1,
  );
  return { combined, level: riskLevelFor(combined) };
}

/// Campos a persistir tras una inferencia (cron o recálculo individual).
export function churnFieldsWithComplaints(
  result: { probability: number; topFactors: string[] },
  userData: FirebaseFirestore.DocumentData,
) {
  const complaint = decayedComplaintRisk(userData.complaint_risk, userData.last_complaint_at);
  const { combined, level } = combineChurnRisk(result.probability, complaint);
  const topFactors = [...(result.topFactors ?? [])];
  const type = userData.last_complaint_type as ComplaintType | undefined;
  if (complaint >= COMPLAINT_ACTIVE_THRESHOLD && type && type !== 'ninguna') {
    topFactors.push(`Queja reciente: ${COMPLAINT_LABELS[type] ?? 'General'}`);
  }
  return {
    churn_risk_ml: result.probability,
    combined_risk: combined,
    churn_risk_level: level,
    churn_top_factors: topFactors,
  };
}

/// Analiza un mensaje del socio y, si es queja, acumula el riesgo.
/// Best-effort: nunca lanza.
export async function recordComplaintFromMessage(memberId: string, text: string): Promise<void> {
  try {
    const analysis = await analyzeSentiment(text);
    if (analysis.complaint_type === 'ninguna' || analysis.severity <= 0) return;

    const ref = db().collection('users').doc(memberId);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data()!;
      const current = decayedComplaintRisk(data.complaint_risk, data.last_complaint_at);
      tx.update(ref, {
        complaint_risk: Math.min(current + analysis.severity * COMPLAINT_INCREMENT, 1),
        last_complaint_type: analysis.complaint_type,
        last_complaint_at: new Date().toISOString(),
        last_complaint_severity: analysis.severity,
      });
    });
  } catch (err) {
    console.warn('[complaint-risk] análisis falló:', err);
  }
}
