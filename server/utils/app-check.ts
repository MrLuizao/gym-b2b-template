import type { H3Event } from 'h3';
import { getAppCheck } from 'firebase-admin/app-check';

import { useAdmin } from './firebase-admin';

/// Verificación de App Check para los endpoints API.
/// Política: si llega `X-Firebase-AppCheck` y es inválido → 401 (bot
/// evidente). Si falta, se tolera salvo que `APP_CHECK_ENFORCE=1` esté
/// en el entorno — así el rollout no rompe clientes sin registrar.
export async function verifyAppCheck(event: H3Event): Promise<void> {
  const token = getHeader(event, 'x-firebase-appcheck') ?? '';
  if (!token) {
    if (process.env.APP_CHECK_ENFORCE === '1') {
      throw createError({
        statusCode: 401,
        statusMessage: 'App Check requerido',
      });
    }
    return;
  }
  try {
    const app = useAdmin().app;
    await getAppCheck(app).verifyToken(token);
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'App Check inválido',
    });
  }
}
