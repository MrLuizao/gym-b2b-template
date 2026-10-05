import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

export interface FirebaseContext {
  enabled: boolean;
  app: FirebaseApp | null;
  db: Firestore | null;
  functions: Functions | null;
  appCheck: AppCheck | null;
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

  /// App Check web — reCAPTCHA Enterprise ("Fraud Defense", invisible,
  /// no interactivo). Requiere plan Blaze — en Spark el registro en
  /// consola falla, por eso esto está apagado mientras la env esté
  /// vacía. En dev con key se usa el token de depuración que imprime
  /// la consola y se registra en Firebase Console → App Check.
  let appCheck: AppCheck | null = null;
  const siteKey = (config.public.recaptchaSiteKey as string | undefined) ?? '';
  if (app && siteKey && import.meta.client) {
    try {
      if (import.meta.dev) {
        (self as unknown as Record<string, unknown>)
          .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      appCheck = null;
    }
  }

  cached = {
    enabled: app !== null,
    app,
    db: app ? getFirestore(app) : null,
    functions: app ? getFunctions(app) : null,
    appCheck,
  };
  return cached;
}
