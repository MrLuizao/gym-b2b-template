import type { ChurnFeatures, ChurnRiskLevel } from '#shared/types';
import weightsData from '../models/churn-weights.json' with { type: 'json' };

export interface ChurnPredictionResult {
  probability: number;
  riskLevel: ChurnRiskLevel;
  topFactors: string[];
  provider: 'sklearn_local';
  scoredAt: string;
}

interface ModelWeights {
  model_type: string;
  features: string[];
  scaler: {
    mean: number[];
    scale: number[];
  };
  coef: number[];
  intercept: number;
  thresholds: {
    high: number;
    medium: number;
  };
}

const model = weightsData as ModelWeights;

/**
 * Motor de inferencia en TypeScript para modelos lineales de scikit-learn (LogisticRegression).
 * Ejecución nativa en Vercel Serverless (<0.1ms por predicción, zero-cold-start).
 */
export function predictChurnScikitLearn(features: ChurnFeatures): ChurnPredictionResult {
  const { mean, scale } = model.scaler;
  const coef = model.coef;
  let logit = model.intercept;

  const contributions: { feature: string; value: number; contribution: number }[] = [];

  for (let i = 0; i < model.features.length; i++) {
    const featureName = model.features[i] as keyof ChurnFeatures;
    const rawVal = features[featureName];
    const numVal = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : Number(rawVal ?? 0);

    const m = mean[i] ?? 0;
    const rawScale = scale[i];
    const s = typeof rawScale === 'number' && rawScale > 0 ? rawScale : 1;
    const z = (numVal - m) / s;
    const w = coef[i] ?? 0;
    const contribution = w * z;

    logit += contribution;
    contributions.push({ feature: featureName, value: numVal, contribution });
  }

  // Sigmoide: P(churn) = 1 / (1 + exp(-logit))
  const probability = 1 / (1 + Math.exp(-logit));
  const clampedProb = Math.min(Math.max(probability, 0.01), 0.99);

  let riskLevel: ChurnRiskLevel = 'low';
  if (clampedProb >= model.thresholds.high) {
    riskLevel = 'high';
  } else if (clampedProb >= model.thresholds.medium) {
    riskLevel = 'medium';
  }

  // Extracción de factores explicativos clave para staff de recepción/gerencia
  const topFactors: string[] = [];

  if (features.days_since_last_visit >= 12) {
    topFactors.push(`Ausente hace ${features.days_since_last_visit} días`);
  } else if (features.days_since_last_visit >= 7) {
    topFactors.push(`1 semana sin visitas`);
  }

  if (features.avg_visits_per_week_last_4 < 1.0) {
    topFactors.push(`Baja asistencia (${features.avg_visits_per_week_last_4.toFixed(1)} visitas/sem)`);
  }

  if (features.class_cancellation_rate >= 0.25) {
    topFactors.push(`Alta cancelación de clases (${Math.round(features.class_cancellation_rate * 100)}%)`);
  }

  if (features.has_payment_late_30d) {
    topFactors.push('Fricción en último cobro');
  }

  if (features.support_tickets_last_30d >= 2) {
    topFactors.push('Múltiples tickets de soporte');
  }

  if (features.goal_streak_current === 0 && features.avg_visits_per_week_last_4 < features.weekly_goal) {
    topFactors.push('Meta semanal no alcanzada');
  }

  if (topFactors.length === 0 && riskLevel !== 'low') {
    // Si la combinación general subió el score sin un outlier obvio:
    topFactors.push('Tendencia de asistencia decreciente');
  }

  return {
    probability: Math.round(clampedProb * 1000) / 1000,
    riskLevel,
    topFactors: topFactors.slice(0, 3),
    provider: 'sklearn_local',
    scoredAt: new Date().toISOString(),
  };
}
