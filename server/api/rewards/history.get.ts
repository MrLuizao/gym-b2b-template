import type { PointsHistoryEntry } from '#shared/types';

import { db, toMs } from '../../utils/db';
import { requireMember } from '../../utils/member-auth';

/// GET /api/rewards/history — historial de movimientos de puntos del socio.
/// Últimos 50 movimientos, más recientes primero.
export default defineEventHandler(
  async (event): Promise<PointsHistoryEntry[]> => {
    const member = await requireMember(event);

    const snap = await db()
      .collection('users')
      .doc(member.id)
      .collection('pointsHistory')
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.type ?? 'manual_adjustment',
        delta: Number(d.delta ?? 0),
        balance: Number(d.balance ?? 0),
        description: String(d.description ?? ''),
        refId: d.ref_id ?? null,
        createdAt: toMs(d.created_at) ?? 0,
      };
    });
  },
);
