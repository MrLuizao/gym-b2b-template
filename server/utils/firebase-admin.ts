import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

/// Admin SDK — el servidor Nuxt ES el backend (bypasea security rules).
/// Credenciales: env FIREBASE_SERVICE_ACCOUNT (JSON) o service-account.json
/// en la raíz del repo (gitignored).

function loadServiceAccount(): Record<string, string> {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fromEnv) return JSON.parse(fromEnv);
  const file = resolve(process.cwd(), 'service-account.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function useAdmin() {
  const app =
    getApps()[0] ??
    initializeApp({ credential: cert(loadServiceAccount()) });
  return {
    app,
    db: getFirestore(app),
    auth: getAuth(app),
    messaging: getMessaging(app),
  };
}
