import { getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { FetchOptions } from 'ofetch';

/// $fetch + Authorization: Bearer <idToken> cuando hay sesión Firebase.
/// Auto-importado — usar en lugar de $fetch para llamadas a /api/*.
export async function $api<T = unknown>(
  request: string,
  opts?: FetchOptions<'json'>,
): Promise<T> {
  let token: string | null = null;
  const app = getApps()[0];
  if (app) {
    const auth = getAuth(app);
    /// Espera a que Firebase restaure la sesión persistida tras un reload.
    await auth.authStateReady();
    token = (await auth.currentUser?.getIdToken()) ?? null;
  }
  const headers = new Headers(opts?.headers as HeadersInit | undefined);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return $fetch<T>(request, { ...opts, headers }) as Promise<T>;
}
