import { Timestamp } from 'firebase-admin/firestore';

import { db } from './db';
import { useAdmin } from './firebase-admin';

/// Audiencia → topic FCM. La app suscribe `all_members` + `branch_{id}`
/// + `expired_members` según su perfil — no hace falta guardar tokens.
export function topicFor(log: FirebaseFirestore.DocumentData): string {
  const audience = String(log.audience ?? 'ALL');
  const branchId = log.branch_id as string | null | undefined;
  if (audience === 'BRANCH' && branchId) {
    return `branch_${branchId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  if (audience === 'EXPIRED') return 'expired_members';
  return 'all_members';
}

export interface PushSendResult {
  sent: number;
  fcmError: string | null;
}

/// Envío real por FCM al topic de la audiencia. El conteo `sent` es
/// estimado — FCM no expone suscriptores por topic.
export async function sendPushDoc(
  snap: FirebaseFirestore.DocumentSnapshot,
): Promise<PushSendResult> {
  const log = snap.data() ?? {};
  let sent = 0;
  let fcmError: string | null = null;
  try {
    await useAdmin().messaging.send({
      topic: topicFor(log),
      notification: {
        title: String(log.title ?? ''),
        body: String(log.body ?? ''),
      },
      data: {
        kind: String(log.kind ?? 'BRAND'),
        branch_id: String(log.branch_id ?? ''),
        target: String(log.target ?? 'auto'),
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    sent = log.audience === 'EXPIRED' ? 0 : 1;
  } catch (error) {
    fcmError = error instanceof Error ? error.message : String(error);
  }

  await snap.ref.update({
    status: fcmError ? 'FAILED' : 'SENT',
    sent,
    fcm_topic: topicFor(log),
    fcm_error: fcmError,
    sent_at: Timestamp.now(),
  });
  return { sent, fcmError };
}

/// Despacha borradores con scheduled_at ya vencido. Se "reclama" cada doc
/// (status DRAFT → SENDING) en transacción para no duplicar envíos si dos
/// ticks o instancias coinciden.
export async function dispatchDuePushLogs(limit = 10): Promise<number> {
  /// Solo filtra status en Firestore (índice simple) — la comparación de
  /// scheduled_at va en código para no requerir índice compuesto.
  const col = db().collection('pushLogs');
  const snap = await col.where('status', '==', 'DRAFT').limit(200).get();
  const now = Date.now();
  const due = snap.docs
    .filter((doc) => {
      const at = doc.data().scheduled_at;
      return at instanceof Timestamp && at.toMillis() <= now;
    })
    .slice(0, limit);

  let dispatched = 0;
  for (const doc of due) {
    const claimed = await db().runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.status !== 'DRAFT') return false;
      tx.update(doc.ref, { status: 'SENDING' });
      return true;
    });
    if (!claimed) continue;
    await sendPushDoc(await doc.ref.get());
    dispatched++;
  }
  return dispatched;
}
