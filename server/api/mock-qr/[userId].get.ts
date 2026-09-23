import { db } from '../../utils/db';
import { signQrToken } from '../../utils/qr';
import { requireStaff } from '../../utils/staff-auth';

/// Genera un token QR firmado para probar el scanner con un socio real.
export default defineEventHandler(async (event) => {
  await requireStaff(event);
  const userId = getRouterParam(event, 'userId') ?? '';
  const snap = await db().collection('users').doc(userId).get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
  }
  const issuedAt = Date.now();
  return {
    token: JSON.stringify({
      v: 1,
      uid: snap.id,
      ts: issuedAt,
      sig: signQrToken(snap.id, issuedAt),
    }),
  };
});
