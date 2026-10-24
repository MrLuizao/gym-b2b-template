import type {
  ChurnFeatures,
  ChurnRiskLevel,
  RetentionPlaybookId,
} from '#shared/types';
import weightsData from '../models/churn-weights.json' with { type: 'json' };

export interface ChurnPredictionResult {
  probability: number;
  riskLevel: ChurnRiskLevel;
  topFactors: string[];
  suggestedPlaybook: RetentionPlaybookId;
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

/// Umbrales del modelo — los reusa `complaint-risk.ts` para nivelar el
/// riesgo combinado (ML + quejas) con la misma escala.
export const CHURN_THRESHOLDS = model.thresholds;

function formatFactorLabel(
  feature: keyof ChurnFeatures,
  features: ChurnFeatures,
): string | null {
  switch (feature) {
    case 'days_since_last_visit':
      if (features.days_since_last_visit >= 5) {
        return `Ausente hace ${features.days_since_last_visit} días`;
      }
      return null;
    case 'avg_visits_per_week_last_4':
      if (features.avg_visits_per_week_last_4 < 2.0) {
        return `Frecuencia baja (${features.avg_visits_per_week_last_4.toFixed(1)}/sem vs meta ${features.weekly_goal})`;
      }
      return null;
    case 'has_payment_late_30d':
      return features.has_payment_late_30d ? 'Fricción en último cobro' : null;
    case 'class_cancellation_rate':
      if (features.class_cancellation_rate >= 0.2) {
        return `Cancelación de clases (${Math.round(features.class_cancellation_rate * 100)}%)`;
      }
      return null;
    case 'support_tickets_last_30d':
      if (features.support_tickets_last_30d >= 1) {
        return `${features.support_tickets_last_30d} ticket${features.support_tickets_last_30d > 1 ? 's' : ''} de soporte reciente${features.support_tickets_last_30d > 1 ? 's' : ''}`;
      }
      return null;
    case 'goal_streak_current':
      if (
        features.goal_streak_current === 0 &&
        features.avg_visits_per_week_last_4 < features.weekly_goal
      ) {
        return `Racha rota (meta ${features.weekly_goal}/sem)`;
      }
      return null;
    case 'visits_variance':
      if (features.visits_variance >= 1.2) {
        return 'Asistencia irregular entre semanas';
      }
      return null;
    case 'membership_months_active':
      if (features.membership_months_active <= 2) {
        return 'Socio en etapa inicial (<2 meses)';
      }
      return null;
    default:
      return null;
  }
}

export function selectRetentionPlaybook(
  features: ChurnFeatures,
  sortedContributions: Array<{ feature: keyof ChurnFeatures; contribution: number }>,
): RetentionPlaybookId {
  if (features.has_payment_late_30d) {
    return 'payment_assist';
  }
  if (features.support_tickets_last_30d >= 2) {
    return 'human_care';
  }
  if (features.class_cancellation_rate >= 0.25) {
    return 'schedule_unlock';
  }
  if (
    (features.goal_streak_current === 0 && features.points_balance >= 50) ||
    (features.days_since_last_visit >= 7 && features.points_balance >= 25)
  ) {
    return 'streak_rescue';
  }

  const topDriver = sortedContributions[0]?.feature;
  if (topDriver === 'class_cancellation_rate') return 'schedule_unlock';
  if (topDriver === 'support_tickets_last_30d') return 'human_care';
  if (topDriver === 'goal_streak_current') return 'streak_rescue';

  return 'habit_boost';
}

/**
 * Motor de inferencia en TypeScript para modelos lineales de scikit-learn (LogisticRegression).
 * Ordena las contribuciones matemáticas reales (w_i * z_i) de cada socio para explicar el score
 * y elegir el Playbook de Retención óptimo.
 */
export function predictChurnScikitLearn(features: ChurnFeatures): ChurnPredictionResult {
  const { mean, scale } = model.scaler;
  const coef = model.coef;
  let logit = model.intercept;

  const contributions: {
    feature: keyof ChurnFeatures;
    value: number;
    contribution: number;
  }[] = [];

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

  // Ordenar por impacto real en el riesgo (mayor contribución positiva primero)
  const positiveDrivers = [...contributions]
    .filter((c) => c.contribution > 0.05)
    .sort((a, b) => b.contribution - a.contribution);

  const topFactors: string[] = [];
  for (const driver of positiveDrivers) {
    const label = formatFactorLabel(driver.feature, features);
    if (label && !topFactors.includes(label)) {
      topFactors.push(label);
    }
    if (topFactors.length >= 3) break;
  }

  if (topFactors.length === 0 && riskLevel !== 'low') {
    topFactors.push('Tendencia de asistencia decreciente');
  }

  const suggestedPlaybook = selectRetentionPlaybook(features, positiveDrivers);

  return {
    probability: Math.round(clampedProb * 1000) / 1000,
    riskLevel,
    topFactors: topFactors.slice(0, 3),
    suggestedPlaybook,
    provider: 'sklearn_local',
    scoredAt: new Date().toISOString(),
  };
}
