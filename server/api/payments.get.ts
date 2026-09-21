import type { PaymentRecord } from '#shared/types';
import { useMockDb } from '../utils/mock-db';

export default defineEventHandler((event): PaymentRecord[] => {
  const db = useMockDb();
  const query = getQuery(event);
  const status = typeof query.status === 'string' ? query.status : null;
  const filtered = status
    ? db.payments.filter((p) => p.status === status)
    : db.payments;
  return [...filtered]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => {
      const member = db.members.find((m) => m.id === p.memberId);
      return {
        ...p,
        memberNumber: member?.memberNumber ?? null,
        memberPhotoUrl: member?.photoUrl ?? null,
      };
    });
});
