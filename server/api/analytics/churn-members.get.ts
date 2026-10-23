import { getFirestore } from 'firebase-admin/firestore';
import { defineEventHandler, getQuery } from 'h3';
import type { ChurnMembersResponse, ChurnRiskLevel } from '#shared/types';
import { getBusinessFeatures } from '../../utils/config';
import { requireStaff } from '../../utils/staff-auth';

/**
 * GET /api/analytics/churn-members
 * Lista de socios con análisis de riesgo de abandono (Churn ML) y KPIs agregados.
 */
export default defineEventHandler(async (event): Promise<ChurnMembersResponse> => {
  const staff = await requireStaff(event);
  const featuresConfig = await getBusinessFeatures();
  if (!featuresConfig.ai_churn_prediction?.enabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Módulo de Retención IA no habilitado para este despliegue',
    });
  }
  const db = getFirestore();
  const query = getQuery(event);

  const riskLevelParam = (query.risk_level as string) || 'all';
  // Si es gerente, restringir a su sede obligatoriamente
  let branchId = query.branch_id as string | undefined;
  if (staff.role === 'MANAGER' && staff.branchId) {
    branchId = staff.branchId;
  }

  const limit = Math.min(Math.max(parseInt((query.limit as string) || '50', 10), 1), 200);

  // Obtener todos los socios activos de la sede o global
  let baseQuery: FirebaseFirestore.Query = db
    .collection('users')
    .where('membership_status', '==', 'ACTIVE');

  if (branchId) {
    baseQuery = baseQuery.where('branch_id', '==', branchId);
  }

  const snapshot = await baseQuery.get();

  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;
  const totalActive = snapshot.size;

  const allMembers = snapshot.docs.map((doc) => {
    const data = doc.data();
    const feat = data.latest_churn_features || {};

    const riskLevel: ChurnRiskLevel =
      data.churn_risk_level === 'high' || data.churn_risk_level === 'medium' || data.churn_risk_level === 'low'
        ? data.churn_risk_level
        : 'low';

    if (riskLevel === 'high') highRisk++;
    else if (riskLevel === 'medium') mediumRisk++;
    else lowRisk++;

    return {
      id: doc.id,
      name: (data.name as string) || 'Socio sin nombre',
      email: (data.contact_email as string) || (data.email as string) || '',
      branch_id: (data.branch_id as string) || '',
      membership_status: (data.membership_status as string) || 'ACTIVE',
      churn_risk_ml: typeof data.churn_risk_ml === 'number' ? data.churn_risk_ml : 0,
      churn_risk_level: riskLevel,
      churn_scored_at: data.churn_scored_at as string | undefined,
      churn_provider: data.churn_provider,
      churn_top_factors: Array.isArray(data.churn_top_factors) ? data.churn_top_factors : [],
      days_since_last_visit: typeof feat.days_since_last_visit === 'number' ? feat.days_since_last_visit : 0,
      avg_visits_per_week_last_4:
        typeof feat.avg_visits_per_week_last_4 === 'number' ? feat.avg_visits_per_week_last_4 : 0,
      points: typeof data.points === 'number' ? data.points : 0,
    };
  });

  // Filtrar según el nivel de riesgo solicitado
  let filtered = allMembers;
  if (riskLevelParam !== 'all') {
    filtered = allMembers.filter((m) => m.churn_risk_level === riskLevelParam);
  }

  // Ordenar de mayor a menor riesgo
  filtered.sort((a, b) => b.churn_risk_ml - a.churn_risk_ml);

  return {
    members: filtered.slice(0, limit),
    total: filtered.length,
    kpis: {
      highRisk,
      mediumRisk,
      lowRisk,
      totalActive,
    },
    filters: {
      risk_level: riskLevelParam,
      branch_id: branchId,
    },
  };
});
