/// Push automático de retención (tras `churn-predict`).
///
/// Política: solo riesgo ALTO, 1 push cada 14 días por socio (cualquier
/// intervención previa — manual o automática — cuenta), máximo
/// `MAX_PER_RUN` por corrida, y solo con `AI_CHURN_AUTO_PUSH=1`.
/// Reusa el mensaje Gemini del playbook y sella `last_retention_intervention`
/// con `auto: true` para que cuente en "ingresos salvados".

import { getFirestore } from 'firebase-admin/firestore';

import type { RetentionPlaybookId } from '#shared/types';

import { useAdmin } from './firebase-admin';
import { generateRetentionPlaybookMessage } from './gemini';

export const AUTO_PUSH_COOLDOWN_DAYS = 14;
const MAX_PER_RUN = 60;
const CONCURRENCY = 5;

export interface AutoPushCandidate {
  memberId: string;
  data: FirebaseFirestore.DocumentData;
  playbook: RetentionPlaybookId;
  topFactors: string[];
  riskMl: number;
}

/// ¿Ya hubo una intervención dentro del periodo de enfriamiento?
export function inCooldown(data: FirebaseFirestore.DocumentData, nowMs = Date.now()): boolean {
  const at = (data.last_retention_intervention as { at?: string } | undefined)?.at;
  const ms = at ? Date.parse(at) : Number.NaN;
  return Number.isFinite(ms) && nowMs - ms < AUTO_PUSH_COOLDOWN_DAYS * 86_400_000;
}

async function sendOne(c: AutoPushCandidate): Promise<boolean> {
  const feat = c.data.latest_churn_features || {};
  const generated = await generateRetentionPlaybookMessage({
    memberName: (c.data.name as string) || 'Socio',
    daysSinceLastVisit: Number(feat.days_since_last_visit ?? 10),
    avgVisitsPerWeek: Number(feat.avg_visits_per_week_last_4 ?? 1.2),
    points: Number(c.data.points ?? 0),
    weeklyGoal: Number(c.data.weekly_goal ?? 4),
    playbook: c.playbook,
    action: 'push',
    topFactors: c.topFactors,
  });

  const topic = `member_${c.memberId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  await useAdmin().messaging.send({
    topic,
    notification: { title: generated.title, body: generated.message },
    data: { type: 'retention', target: 'home', playbook: c.playbook },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  });

  // Sello solo si el push salió — si FCM falla se reintenta mañana.
  await getFirestore().collection('users').doc(c.memberId).update({
    last_retention_intervention: {
      at: new Date().toISOString(),
      action: 'push',
      playbook: c.playbook,
      staff_uid: null,
      auto: true,
      risk_ml: c.riskMl,
      returned_at: null,
      converted_payment_id: null,
    },
  });
  return true;
}

/// Envía los pushes en lotes pequeños; nunca lanza.
export async function runAutoRetentionPushes(
  candidates: AutoPushCandidate[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const batch = candidates.slice(0, MAX_PER_RUN);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(batch.slice(i, i + CONCURRENCY).map(sendOne));
    for (const r of results) {
      if (r.status === 'fulfilled') sent++;
      else {
        failed++;
        console.warn('[auto-retention] push falló:', r.reason);
      }
    }
  }
  return { sent, failed, skipped: Math.max(candidates.length - batch.length, 0) };
}
