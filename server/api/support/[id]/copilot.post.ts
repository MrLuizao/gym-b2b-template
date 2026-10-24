import type { Timestamp } from 'firebase-admin/firestore';
import type { ChurnRiskLevel, SupportCopilotResponse } from '#shared/types';
import { db } from '../../../utils/db';
import { generateSupportCopilotSuggestions } from '../../../utils/gemini';
import { requireBranchScope, requireStaff } from '../../../utils/staff-auth';

/**
 * POST /api/support/:id/copilot
 * Lee la conversación activa y la ficha completa del socio para clasificar
 * la intención/urgencia y generar 3 borradores de respuesta con Google Gemini.
 */
export default defineEventHandler(async (event): Promise<SupportCopilotResponse> => {
  const staff = await requireStaff(event);
  const convId = getRouterParam(event, 'id') ?? '';

  const convSnap = await db().collection('conversations').doc(convId).get();
  if (!convSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Conversación no encontrada' });
  }

  const conv = convSnap.data()!;
  requireBranchScope(staff, conv.branch_id as string);

  const memberId = String(conv.member_id ?? '');
  const [memberSnap, msgsSnap] = await Promise.all([
    db().collection('users').doc(memberId).get(),
    convSnap.ref.collection('messages').orderBy('created_at', 'asc').limitToLast(8).get(),
  ]);

  const member = memberSnap.data() ?? {};
  let planName = 'Sin plan';
  if (member.membership_plan_id) {
    const planSnap = await db()
      .collection('plans')
      .doc(String(member.membership_plan_id))
      .get();
    if (planSnap.exists) {
      planName = String(planSnap.data()?.name ?? member.membership_plan_id);
    }
  }

  const untilTs = member.membership_until as Timestamp | undefined;
  const membershipUntil = untilTs?.toDate
    ? untilTs.toDate().toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const feat = (member.latest_churn_features ?? {}) as Record<string, unknown>;
  const churnRiskLevel: ChurnRiskLevel =
    member.churn_risk_level === 'high' ||
    member.churn_risk_level === 'medium' ||
    member.churn_risk_level === 'low'
      ? member.churn_risk_level
      : 'low';
  const churnRiskPct = Math.round(Number(member.churn_risk_ml ?? 0) * 100);
  const daysSinceLastVisit = Number(feat.days_since_last_visit ?? 0);
  const points = Number(member.points ?? 0);
  const goalStreak = Number(member.goal_streak ?? 0);
  const weeklyGoal = Number(member.weekly_goal ?? 4);
  const memberName = String(member.name ?? conv.member_name ?? 'Socio');
  const membershipStatus = String(member.membership_status ?? 'EXPIRED');

  const messages = msgsSnap.docs.map((d) => {
    const m = d.data();
    return {
      sender: (m.sender === 'staff' ? 'staff' : 'member') as 'member' | 'staff',
      text: String(m.text ?? ''),
    };
  });

  const copilot = await generateSupportCopilotSuggestions({
    memberName,
    planName,
    membershipStatus,
    membershipUntil,
    points,
    goalStreak,
    weeklyGoal,
    churnRiskLevel,
    daysSinceLastVisit,
    messages,
  });

  return {
    intent: copilot.intent,
    intentLabel: copilot.intentLabel,
    urgency: copilot.urgency,
    aiPowered: copilot.aiPowered,
    memberContext: {
      id: memberId,
      name: memberName,
      planName,
      membershipStatus,
      membershipUntil,
      points,
      goalStreak,
      weeklyGoal,
      churnRiskLevel,
      churnRiskPct,
      daysSinceLastVisit,
    },
    suggestions: copilot.suggestions,
  };
});
