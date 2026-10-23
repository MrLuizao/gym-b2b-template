import { getFirestore } from 'firebase-admin/firestore';
import { defineEventHandler, readBody } from 'h3';
import type { ChurnFeatures, ChurnPredictionProvider } from '#shared/types';
import { predictChurnScikitLearn } from '../../utils/churn-model';
import { getBusinessFeatures } from '../../utils/config';
import { requireStaff } from '../../utils/staff-auth';
import { predictChurnVertexAI, type VertexConfig } from '../../utils/vertex-ai';

/**
 * POST /api/analytics/churn-score
 * Inferencia bajo demanda para un socio individual.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event);
  const db = getFirestore();
  const body = await readBody(event);
  const memberId = body?.member_id;

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'member_id es requerido' });
  }

  const memberRef = db.collection('users').doc(memberId);
  const memberDoc = await memberRef.get();

  if (!memberDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }

  const memberData = memberDoc.data()!;
  let features: ChurnFeatures | null = memberData.latest_churn_features || null;

  if (!features) {
    const featSnap = await memberRef
      .collection('churn_features')
      .orderBy('scored_at', 'desc')
      .limit(1)
      .get();

    if (!featSnap.empty && featSnap.docs[0]) {
      features = featSnap.docs[0].data() as ChurnFeatures;
    }
  }

  if (!features) {
    // Si aún no tiene features calculadas, crear una estimación base
    features = {
      avg_visits_per_week_last_4: 1.5,
      visits_variance: 0.5,
      days_since_last_visit: 10,
      class_cancellation_rate: 0,
      unique_branches_visited: 1,
      active_class_types_count: 1,
      has_payment_late_30d: false,
      support_tickets_last_30d: 0,
      goal_streak_current: Number(memberData.goal_streak ?? 0),
      weekly_goal: Number(memberData.weekly_goal ?? 4),
      points_balance: Number(memberData.points ?? 0),
      membership_months_active: 1,
      scored_at: new Date().toISOString(),
    };
  }

  const config = await getBusinessFeatures();
  const churnConfig = config.ai_churn_prediction;
  if (!churnConfig?.enabled) {
    throw createError({ statusCode: 403, statusMessage: 'Módulo de Retención IA no habilitado' });
  }
  const provider: ChurnPredictionProvider = churnConfig?.provider || 'sklearn_local';

  let result;
  if (
    provider === 'vertex_ai' &&
    churnConfig?.settings?.vertex_project_id &&
    churnConfig?.settings?.vertex_endpoint_id
  ) {
    const vertexConfig: VertexConfig = {
      projectId: churnConfig.settings.vertex_project_id,
      location: churnConfig.settings.vertex_location || 'us-central1',
      endpointId: churnConfig.settings.vertex_endpoint_id,
    };
    result = await predictChurnVertexAI(features, vertexConfig);
  } else {
    result = predictChurnScikitLearn(features);
  }

  // Guardar resultado
  await memberRef.update({
    churn_risk_ml: result.probability,
    churn_risk_level: result.riskLevel,
    churn_top_factors: result.topFactors,
    churn_provider: result.provider,
    churn_scored_at: result.scoredAt,
  });

  return {
    success: true,
    member_id: memberId,
    churn_probability: result.probability,
    risk_level: result.riskLevel,
    top_factors: result.topFactors,
    provider: result.provider,
    features,
  };
});
