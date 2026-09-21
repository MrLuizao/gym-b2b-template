import { signQrToken, useMockDb } from '../../utils/mock-db';

export default defineEventHandler((event) => {
  const userId = getRouterParam(event, 'userId');
  const db = useMockDb();
  const member = db.members.find((m) => m.id === userId);
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }
  const issuedAt = Date.now();
  return {
    token: JSON.stringify({
      v: 1,
      uid: member.id,
      ts: issuedAt,
      sig: signQrToken(member.id, issuedAt),
    }),
  };
});
