import type { PaymentRecord } from '#shared/types';

import { db, toPayment } from '../utils/db';
import { requireStaff } from '../utils/staff-auth';

export default defineEventHandler(async (event): Promise<PaymentRecord[]> => {
  const staff = await requireStaff(event);
  const query = getQuery(event);
  const status = typeof query.status === 'string' ? query.status : null;

  let ref = db()
    .collection('payments')
    .orderBy('created_at', 'desc') as FirebaseFirestore.Query;
  if (staff.role !== 'ADMIN' && staff.branchId) {
    ref = ref.where('branch_id', '==', staff.branchId);
  }
  if (status) ref = ref.where('status', '==', status);
  const snap = await ref.limit(200).get();

  /// memberNumber/photoUrl se resuelven del doc del socio.
  const memberIds = [...new Set(snap.docs.map((d) => d.get('member_id') as string))];
  const memberSnaps = await Promise.all(
    memberIds.map((id) => db().collection('users').doc(id).get()),
  );
  const members = new Map(memberSnaps.map((s) => [s.id, s.data() ?? {}]));

  return snap.docs.map((d) => {
    const p = toPayment(d);
    const m = members.get(p.memberId) ?? {};
    return {
      ...p,
      memberNumber: p.memberNumber ?? (m.member_number as string) ?? null,
      memberPhotoUrl: (m.photo_url as string) ?? null,
    };
  });
});
