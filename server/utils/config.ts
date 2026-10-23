import { getFirestore } from 'firebase-admin/firestore';
import type { BusinessFeatures } from '#shared/types';

export type { BusinessFeatures };

/**
 * Obtiene la configuración de features del negocio.
 * Controlado por el desarrollador mediante variables de entorno (Deployment / Vercel)
 * con respaldo en Firestore (/config/features).
 */
export async function getBusinessFeatures(): Promise<BusinessFeatures> {
  // 1. Configuración base desde variables de entorno del desarrollador
  const envEnabled =
    process.env.AI_CHURN_ENABLED === '1' || process.env.AI_CHURN_ENABLED === 'true';
  const envProvider =
    (process.env.AI_CHURN_PROVIDER as 'sklearn_local' | 'vertex_ai') || 'sklearn_local';
  const envPlan =
    (process.env.AI_CHURN_PLAN as 'basic' | 'premium' | 'enterprise') || 'premium';
  const envThreshold = parseInt(process.env.AI_CHURN_ALERT_THRESHOLD || '65', 10);
  const envAutoPush = process.env.AI_CHURN_AUTO_PUSH === '1';

  const baseConfig: BusinessFeatures = {
    ai_churn_prediction: {
      enabled: envEnabled,
      provider: envProvider,
      plan: envPlan,
      settings: {
        daily_batch: true,
        alert_threshold: Number.isNaN(envThreshold) ? 65 : envThreshold,
        auto_push_enabled: envAutoPush,
        vertex_project_id: process.env.VERTEX_PROJECT_ID || '',
        vertex_location: process.env.VERTEX_LOCATION || 'us-central1',
        vertex_endpoint_id: process.env.VERTEX_ENDPOINT_ID || '',
      },
    },
  };

  // 2. Consulta opcional de Firestore para overrides
  try {
    const db = getFirestore();
    const doc = await db.collection('config').doc('features').get();

    if (doc.exists) {
      const data = doc.data() as Partial<BusinessFeatures>;
      if (data.ai_churn_prediction) {
        return {
          ai_churn_prediction: {
            ...baseConfig.ai_churn_prediction,
            ...data.ai_churn_prediction,
            // Si la env var lo apaga explícitamente, gana el desarrollador
            enabled: envEnabled || data.ai_churn_prediction.enabled === true,
            settings: {
              ...baseConfig.ai_churn_prediction.settings,
              ...(data.ai_churn_prediction.settings ?? {}),
            },
          },
        };
      }
    }
  } catch (err) {
    console.warn('[Config] No se pudo leer /config/features, usando env vars:', err);
  }

  return baseConfig;
}

/**
 * Actualiza la configuración de features (para uso de scripts de aprovisionamiento del desarrollador).
 */
export async function updateBusinessFeatures(
  features: Partial<BusinessFeatures>,
): Promise<void> {
  const db = getFirestore();
  await db.collection('config').doc('features').set(features, { merge: true });
}
