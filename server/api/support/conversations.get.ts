import type { Conversation } from '#shared/types';

import { db } from '../../utils/db';
import { requireStaff } from '../../utils/staff-auth';

/// Lista conversaciones abiertas — staff ve las de su sede, admin todas.
export default defineEventHandler(async (event): Promise<Conversation[]> => {
  const staff = await requireStaff(event);

  let ref = db()
    .collection('conversations')
    .where('status', '==', 'open')
    .orderBy('last_message_at', 'desc') as FirebaseFirestore.Query;

  if (staff.role !== 'ADMIN' && staff.branchId) {
    ref = ref.where('branch_id', '==', staff.branchId);
  }

  const snap = await ref.limit(50).get();
  return snap.docs.map((d) => toConversation(d));
});

function toConversation(
  doc: FirebaseFirestore.DocumentSnapshot,
): Conversation {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    memberId: String(d.member_id ?? ''),
    memberName: String(d.member_name ?? ''),
    branchId: String(d.branch_id ?? ''),
    status: d.status === 'resolved' ? 'resolved' : 'open',
    createdAt: d.created_at?.toMillis?.() ?? Date.now(),
    lastMessageAt: d.last_message_at?.toMillis?.() ?? Date.now(),
    lastMessagePreview: String(d.last_message_preview ?? ''),
    unreadMember: Number(d.unread_member ?? 0),
    unreadStaff: Number(d.unread_staff ?? 0),
  };
}
