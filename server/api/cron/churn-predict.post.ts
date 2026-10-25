import { getFirestore } from 'firebase-admin/firestore';
import { defineEventHandler, getHeader, getQuery, readBody } from 'h3';
import type { ChurnFeatures, ChurnPredictionProvider } from '#shared/types';
import { predictChurnScikitLearn } from '../../utils/churn-model';
import {
  type AutoPushCandidate,
  inCooldown,
  runAutoRetentionPushes,
} from '../../utils/auto-retention';
import { churnFieldsWithComplaints } from '../../utils/complaint-risk';
import { getBusinessFeatures } from '../../utils/config';
import { recordFeatureUsage } from '../../utils/telemetry';
import { predictChurnVertexAI, type VertexConfig } from '../../utils/vertex-ai';

/**
 * Cron Job para ejecutar inferencia de Churn Prediction en lote sobre todos los socios activos.
 * Soporta dos motores:
 * 1. 'sklearn_local' -> Inferencia nativa en TypeScript de scikit-learn (incluido / Vercel Serverless).
 * 2. 'vertex_ai' -> Inferencia en la nube contra Google Cloud AutoML Tabular (Módulo Premium bajo demanda).
 */
export default defineEventHandler(async (event) => {
  const db = getFirestore();

  // 1. Validar si el módulo está habilitado
  const config = await getBusinessFeatures();
  const churnConfig = config.ai_churn_prediction;

  if (!churnConfig?.enabled || !churnConfig?.settings?.daily_batch) {
    return { success: true, skipped: true, reason: 'Prediccion de churn desactivada en configuracion' };
  }

  // 2. Validación de seguridad para cron
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = getHeader(event, 'authorization');
    const query = getQuery(event);
    let bodySecret = '';
    try {
      const b = await readBody(event);
      bodySecret = b?.secret || '';
    } catch {
      // Ignorar si no trajo body (GET de Vercel Cron)
    }

    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const provided = bearer || (query?.secret as string) || bodySecret;

    if (provided !== cronSecret) {
      throw createError({ statusCode: 401, statusMessage: 'Cron secret no autorizado' });
    }
  }

  // 3. Obtener socios activos
  const membersSnap = await db
    .collection('users')
    .where('membership_status', '==', 'ACTIVE')
    .get();

  if (membersSnap.empty) {
    return { success: true, processed: 0, message: 'No hay socios activos para predecir' };
  }

  const provider: ChurnPredictionProvider = churnConfig.provider || 'sklearn_local';
  const vertexConfig: VertexConfig = {
    projectId: churnConfig.settings.vertex_project_id || '',
    location: churnConfig.settings.vertex_location || 'us-central1',
    endpointId: churnConfig.settings.vertex_endpoint_id || '',
  };

  let batch = db.batch();
  let opCount = 0;
  let processed = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  const autoPushEnabled = churnConfig.settings.auto_push_enabled === true;
  const autoCandidates: AutoPushCandidate[] = [];

  for (const doc of membersSnap.docs) {
    const memberId = doc.id;
    const data = doc.data();

    // Obtener features
    let features: ChurnFeatures | null = data.latest_churn_features || null;

    if (!features) {
      const featSnap = await db
        .collection('users')
        .doc(memberId)
        .collection('churn_features')
        .orderBy('scored_at', 'desc')
        .limit(1)
        .get();

      if (!featSnap.empty && featSnap.docs[0]) {
        features = featSnap.docs[0].data() as ChurnFeatures;
      }
    }

    if (!features) {
      continue;
    }

    // Ejecutar predicción según el proveedor configurado
    let result;
    if (provider === 'vertex_ai' && vertexConfig.projectId && vertexConfig.endpointId) {
      result = await predictChurnVertexAI(features, vertexConfig);
    } else {
      result = predictChurnScikitLearn(features);
    }

    // Riesgo combinado: ML puro en churn_risk_ml + quejas (decaídas) en
    // combined_risk; el nivel sale del combinado.
    const fields = churnFieldsWithComplaints(result, data);

    if (fields.churn_risk_level === 'high') highRiskCount++;
    else if (fields.churn_risk_level === 'medium') mediumRiskCount++;
    else lowRiskCount++;

    if (
      autoPushEnabled &&
      fields.churn_risk_level === 'high' &&
      !inCooldown(data)
    ) {
      autoCandidates.push({
        memberId,
        data,
        playbook: result.suggestedPlaybook,
        topFactors: fields.churn_top_factors,
        riskMl: result.probability,
      });
    }

    const memberRef = db.collection('users').doc(memberId);
    batch.update(memberRef, {
      ...fields,
      churn_suggested_playbook: result.suggestedPlaybook,
      churn_provider: result.provider,
      churn_scored_at: result.scoredAt,
    });
    opCount++;
    processed++;

    if (opCount >= 400) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  // Push automático (solo riesgo alto, con enfriamiento de 14 días)
  const autoPush = autoPushEnabled
    ? await runAutoRetentionPushes(autoCandidates)
    : null;

  // Registrar telemetría de uso para facturación
  try {
    await recordFeatureUsage({
      feature: 'ai_churn_prediction',
      plan: churnConfig.plan || 'basic',
      active_members_count: membersSnap.size,
      predictions_made: processed,
    });
  } catch (err) {
    console.warn('[Telemetry] Error registrando uso:', err);
  }

  return {
    success: true,
    processed,
    provider,
    auto_push: autoPush,
    kpis: {
      high: highRiskCount,
      medium: mediumRiskCount,
      low: lowRiskCount,
      totalActive: membersSnap.size,
    },
    timestamp: new Date().toISOString(),
  };
});
