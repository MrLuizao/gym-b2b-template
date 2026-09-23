import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

export interface FirebaseContext {
  enabled: boolean;
  app: FirebaseApp | null;
  db: Firestore | null;
  functions: Functions | null;
}

let cached: FirebaseContext | null = null;

export function useFirebase(): FirebaseContext {
  if (cached) return cached;

  const config = useRuntimeConfig();
  /// Nuxt parsea a objeto las env vars que empiezan con `{` — aceptar ambos tipos.
  const raw = config.public.firebaseConfig as
    | string
    | Record<string, string>
    | undefined;

  let app: FirebaseApp | null = null;
  if (raw) {
    try {
      const opts = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, string>) : raw;
      app = getApps()[0] ?? initializeApp(opts);
    } catch {
      app = null;
    }
  }

  cached = {
    enabled: app !== null,
    app,
    db: app ? getFirestore(app) : null,
    functions: app ? getFunctions(app) : null,
  };
  return cached;
}
