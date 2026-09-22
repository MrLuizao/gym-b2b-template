import type { Member } from '#shared/types';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event): Promise<Member> => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const member = db.members.find((m) => m.id === id);
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }

  const body = await readBody<{
    name?: string;
    branchId?: string;
    membershipType?: string;
    membershipUntil?: number | null;
  }>(event);

  if (body?.name !== undefined && body.name.trim()) {
    member.name = body.name.trim().slice(0, 80);
  }
  if (body?.branchId !== undefined) {
    member.branchId = body.branchId;
  }
  if (body?.membershipType !== undefined && body.membershipType.trim()) {
    member.membershipType = body.membershipType.trim();
    member.membershipStatus = 'ACTIVE';
  }
  if (body?.membershipUntil !== undefined) {
    member.membershipUntil =
      typeof body.membershipUntil === 'number' ? body.membershipUntil : null;
  }

  return member;
});
