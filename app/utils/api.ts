import { getApps } from 'firebase/app';
import { getToken } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack';

/// $fetch + Authorization: Bearer <idToken> cuando hay sesión Firebase.
/// Si App Check está activo (reCAPTCHA Enterprise), también manda
/// `X-Firebase-AppCheck` para que el API pueda verificar la app.
/// Auto-importado — usar en lugar de $fetch para llamadas a /api/*.
export async function $api<T = unknown>(
  request: NitroFetchRequest,
  opts?: NitroFetchOptions<NitroFetchRequest>,
): Promise<T> {
  let token: string | null = null;
  let appCheckToken: string | null = null;
  const app = getApps()[0];
  if (app) {
    const auth = getAuth(app);
    /// Espera a que Firebase restaure la sesión persistida tras un reload.
    await auth.authStateReady();
    token = (await auth.currentUser?.getIdToken()) ?? null;
    try {
      appCheckToken = (await getToken(useFirebase().appCheck!, false)).token;
    } catch {
      appCheckToken = null;
    }
  }
  const headers = new Headers(opts?.headers as HeadersInit | undefined);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (appCheckToken) headers.set('X-Firebase-AppCheck', appCheckToken);
  return $fetch<T>(request, { ...opts, headers }) as Promise<T>;
}
