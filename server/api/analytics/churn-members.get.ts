import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineEventHandler, getQuery } from 'h3';
import type {
  ChurnFeatures,
  ChurnMembersResponse,
  ChurnRiskLevel,
  ComplaintType,
  RetentionInterventionInfo,
  RetentionPlaybookId,
} from '#shared/types';
import { selectRetentionPlaybook } from '../../utils/churn-model';
import {
  COMPLAINT_ACTIVE_THRESHOLD,
  combineChurnRisk,
  decayedComplaintRisk,
} from '../../utils/complaint-risk';
import { getBusinessFeatures } from '../../utils/config';
import { requireStaff } from '../../utils/staff-auth';

/**
 * GET /api/analytics/churn-members
 * Lista de socios con análisis de riesgo de abandono (Churn ML), Playbook recomendado
 * y KPIs agregados incluyendo Ingresos Salvados (30d) y Socios Recuperados.
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
  const hasComplaint = query.has_complaint === 'true';

  // Obtener todos los socios activos de la sede o global
  let baseQuery: FirebaseFirestore.Query = db
    .collection('users')
    .where('membership_status', '==', 'ACTIVE');

  if (branchId) {
    baseQuery = baseQuery.where('branch_id', '==', branchId);
  }

  const thirtyDaysAgoMs = Date.now() - 30 * 86_400_000;
  const thirtyDaysAgoTs = Timestamp.fromMillis(thirtyDaysAgoMs);

  const [snapshot, recentPaymentsSnap] = await Promise.all([
    baseQuery.get(),
    db.collection('payments').where('created_at', '>=', thirtyDaysAgoTs).get(),
  ]);

  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;
  let recoveredMembers30d = 0;
  const totalActive = snapshot.size;

  const allMembers = snapshot.docs.map((doc) => {
    const data = doc.data();
    const feat = (data.latest_churn_features || {}) as Partial<ChurnFeatures>;

    const storedLevel: ChurnRiskLevel =
      data.churn_risk_level === 'high' ||
      data.churn_risk_level === 'medium' ||
      data.churn_risk_level === 'low'
        ? data.churn_risk_level
        : 'low';

    // Riesgo combinado al vuelo: ML guardado + queja con decaimiento a hoy.
    const mlRisk = typeof data.churn_risk_ml === 'number' ? data.churn_risk_ml : 0;
    const complaintRisk = decayedComplaintRisk(data.complaint_risk, data.last_complaint_at);
    const scored = typeof data.churn_risk_ml === 'number';
    const { combined: combinedRisk, level: combinedLevel } = combineChurnRisk(mlRisk, complaintRisk);
    const riskLevel: ChurnRiskLevel = scored ? combinedLevel : storedLevel;

    if (riskLevel === 'high') highRisk++;
    else if (riskLevel === 'medium') mediumRisk++;
    else lowRisk++;

    const rawInt = data.last_retention_intervention as
      | {
          at?: string;
          action?: 'push' | 'ticket' | 'bonus_push';
          playbook?: RetentionPlaybookId;
          returned_at?: string | null;
          converted_payment_id?: string | null;
        }
      | undefined;

    let lastIntervention: RetentionInterventionInfo | null = null;
    if (rawInt?.at) {
      lastIntervention = {
        at: rawInt.at,
        action: rawInt.action || 'push',
        playbook: rawInt.playbook || 'habit_boost',
        returnedAt: rawInt.returned_at ?? null,
        convertedPaymentId: rawInt.converted_payment_id ?? null,
      };
      const intMs = Date.parse(rawInt.at);
      if (
        Number.isFinite(intMs) &&
        intMs >= thirtyDaysAgoMs &&
        (rawInt.returned_at || rawInt.converted_payment_id)
      ) {
        recoveredMembers30d++;
      }
    }

    const suggestedPlaybook: RetentionPlaybookId =
      (data.churn_suggested_playbook as RetentionPlaybookId) ||
      selectRetentionPlaybook(
        {
          avg_visits_per_week_last_4: Number(feat.avg_visits_per_week_last_4 ?? 1.5),
          visits_variance: Number(feat.visits_variance ?? 0.5),
          days_since_last_visit: Number(feat.days_since_last_visit ?? 10),
          class_cancellation_rate: Number(feat.class_cancellation_rate ?? 0),
          unique_branches_visited: Number(feat.unique_branches_visited ?? 1),
          active_class_types_count: Number(feat.active_class_types_count ?? 1),
          has_payment_late_30d: Boolean(feat.has_payment_late_30d),
          support_tickets_last_30d: Number(feat.support_tickets_last_30d ?? 0),
          goal_streak_current: Number(data.goal_streak ?? feat.goal_streak_current ?? 0),
          weekly_goal: Number(data.weekly_goal ?? feat.weekly_goal ?? 4),
          points_balance: Number(data.points ?? feat.points_balance ?? 0),
          membership_months_active: Number(feat.membership_months_active ?? 3),
        },
        [],
      );

    return {
      id: doc.id,
      name: (data.name as string) || 'Socio sin nombre',
      email: (data.contact_email as string) || (data.email as string) || '',
      branch_id: (data.branch_id as string) || '',
      membership_status: (data.membership_status as string) || 'ACTIVE',
      churn_risk_ml: mlRisk,
      combined_risk: scored ? combinedRisk : mlRisk,
      churn_risk_level: riskLevel,
      churn_scored_at: data.churn_scored_at as string | undefined,
      churn_provider: data.churn_provider,
      churn_top_factors: Array.isArray(data.churn_top_factors) ? data.churn_top_factors : [],
      suggested_playbook: suggestedPlaybook,
      last_intervention: lastIntervention,
      days_since_last_visit:
        typeof feat.days_since_last_visit === 'number' ? feat.days_since_last_visit : 0,
      avg_visits_per_week_last_4:
        typeof feat.avg_visits_per_week_last_4 === 'number' ? feat.avg_visits_per_week_last_4 : 0,
      points: typeof data.points === 'number' ? data.points : 0,
      goal_streak: Number(data.goal_streak ?? 0),
      weekly_goal: Number(data.weekly_goal ?? 4),
      last_complaint_type: (data.last_complaint_type as ComplaintType | undefined) ?? null,
      last_complaint_at: (data.last_complaint_at as string | undefined) ?? null,
      complaint_risk: complaintRisk,
    };
  });

  // Sumar Ingresos Salvados (30d) de pagos atribuidos a Retención IA
  let savedRevenue30d = 0;
  const convertedMemberIds = new Set<string>();
  for (const pDoc of recentPaymentsSnap.docs) {
    const pData = pDoc.data();
    if (pData.retained_by_ai === true && pData.status === 'APPROVED') {
      if (!branchId || pData.branch_id === branchId) {
        savedRevenue30d += Number(pData.amount ?? 0);
        if (pData.member_id) convertedMemberIds.add(String(pData.member_id));
      }
    }
  }
  if (convertedMemberIds.size > recoveredMembers30d) {
    recoveredMembers30d = convertedMemberIds.size;
  }

  // Filtrar según el nivel de riesgo solicitado
  let filtered = allMembers;
  if (riskLevelParam !== 'all') {
    filtered = allMembers.filter((m) => m.churn_risk_level === riskLevelParam);
  }

  // Filtrar solo con quejas pendientes (riesgo de queja vivo tras decaimiento)
  if (hasComplaint) {
    filtered = filtered.filter(
      (m) =>
        m.complaint_risk >= COMPLAINT_ACTIVE_THRESHOLD &&
        !!m.last_complaint_type &&
        m.last_complaint_type !== 'ninguna',
    );
  }

  // Ordenar de mayor a menor riesgo combinado
  filtered.sort((a, b) => b.combined_risk - a.combined_risk);

  return {
    members: filtered.slice(0, limit),
    total: filtered.length,
    kpis: {
      highRisk,
      mediumRisk,
      lowRisk,
      totalActive,
      savedRevenue30d,
      recoveredMembers30d,
    },
    filters: {
      risk_level: riskLevelParam,
      branch_id: branchId,
    },
  };
});
