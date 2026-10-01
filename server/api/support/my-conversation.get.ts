import type { Conversation } from '#shared/types';

import { db } from '../../utils/db';
import { requireMember } from '../../utils/member-auth';

/// El socio obtiene su conversación abierta (si existe).
export default defineEventHandler(
  async (event): Promise<Conversation | null> => {
    const member = await requireMember(event);

    const snap = await db()
      .collection('conversations')
      .where('member_id', '==', member.id)
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0]!;
    const d = doc.data();
    return {
      id: doc.id,
      memberId: member.id,
      memberName: member.name,
      branchId: member.branchId,
      status: 'open',
      createdAt: d.created_at?.toMillis?.() ?? Date.now(),
      lastMessageAt: d.last_message_at?.toMillis?.() ?? Date.now(),
      lastMessagePreview: String(d.last_message_preview ?? ''),
      unreadMember: Number(d.unread_member ?? 0),
      unreadStaff: Number(d.unread_staff ?? 0),
    };
  },
);
