import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';

export interface StaffSession {
  email: string;
  name: string;
}

function deriveName(email: string): string {
  const handle = email.split('@')[0] ?? 'equipo';
  return handle
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function useAuth() {
  const session = useCookie<StaffSession | null>('cf_b2b_session', {
    default: () => null,
    maxAge: 60 * 60 * 12,
    sameSite: 'lax',
  });

  const isAuthenticated = computed(() => session.value !== null);

  async function login(email: string, password: string): Promise<void> {
    const firebase = useFirebase();
    if (firebase.enabled && firebase.app) {
      const auth: Auth = getAuth(firebase.app);
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } else if (!email.includes('@') || password.length < 4) {
      throw new Error('Email válido y contraseña de 4+ caracteres (modo demo)');
    }
    session.value = { email, name: deriveName(email) };
  }

  function logout(): void {
    session.value = null;
    navigateTo('/login');
  }

  return { session, isAuthenticated, login, logout };
}
