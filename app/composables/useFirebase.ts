import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

export interface FirebaseContext {
  enabled: boolean;
  app: FirebaseApp | null;
  db: Firestore | null;
  functions: Functions | null;
}

export function useFirebase(): FirebaseContext {
  const config = useRuntimeConfig();
  const raw = config.public.firebaseConfig;

  let app: FirebaseApp | null = null;
  if (raw) {
    try {
      app = initializeApp(JSON.parse(raw) as Record<string, string>);
    } catch {
      app = null;
    }
  }

  return {
    enabled: app !== null,
    app,
    db: app ? getFirestore(app) : null,
    functions: app ? getFunctions(app) : null,
  };
}
