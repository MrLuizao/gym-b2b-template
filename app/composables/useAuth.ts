import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';

export type StaffRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST';

export interface StaffSession {
  email: string;
  name: string;
  role: StaffRole;
  branchId: string | null;
  branchName: string | null;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Admin global',
  MANAGER: 'Gerente de sede',
  RECEPTIONIST: 'Recepcionista',
};

/// Prefijos de ruta permitidos por rol. '*' = acceso total.
/// Prefijos de ruta permitidos por rol. '*' = acceso total.
/// El gerente ve TODAS las secciones igual que el admin — la diferencia es
/// de escritura: solo puede editar datos de su propia sucursal, y nunca
/// precios de membresías ni contenido comercial global.
export const ROLE_ROUTES: Record<StaffRole, string[]> = {
  ADMIN: ['*'],
  MANAGER: ['*'],
  RECEPTIONIST: ['/', '/recepcion', '/socios', '/clases', '/entrenadores'],
};

export const ROLE_HOME: Record<StaffRole, string> = {
  ADMIN: '/',
  MANAGER: '/',
  RECEPTIONIST: '/recepcion',
};

export function canAccess(role: StaffRole | undefined, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ROUTES[role];
  if (allowed.includes('*')) return true;
  return allowed.some((prefix) =>
    prefix === '/'
      ? path === '/'
      : path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function homeFor(role: StaffRole | undefined): string {
  return role ? ROLE_HOME[role] : '/login';
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

  const isAuthenticated = computed(
    () => session.value !== null && session.value.role !== undefined,
  );

  async function login(
    email: string,
    password: string,
    role: StaffRole = 'ADMIN',
  ): Promise<void> {
    const firebase = useFirebase();
    if (firebase.enabled && firebase.app) {
      const auth: Auth = getAuth(firebase.app);
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      // TODO: con Firebase el rol y la sede vendrán de custom claims / staff doc
    } else if (!email.includes('@') || password.length < 4) {
      throw new Error('Email válido y contraseña de 4+ caracteres (modo demo)');
    }
    session.value = {
      email,
      name: deriveName(email),
      role,
      branchId: role === 'ADMIN' ? null : 'select',
      branchName: role === 'ADMIN' ? null : 'Select',
    };
  }

  /// Admin gestiona todas las sedes; gerente solo la suya; recepcionista ninguna.
  function canEditBranch(branchId: string): boolean {
    const s = session.value;
    if (s?.role === 'ADMIN') return true;
    return s?.role === 'MANAGER' && s.branchId === branchId;
  }

  /// Entidades multi-sede (clases, entrenadores): admin edita cualquiera;
  /// gerente solo las que pertenecen exclusivamente a su sede — una entidad
  /// compartida con otras sucursales queda bloqueada para él.
  function canEditInBranches(branchIds: string[]): boolean {
    const s = session.value;
    if (s?.role === 'ADMIN') return true;
    return (
      s?.role === 'MANAGER' &&
      !!s.branchId &&
      branchIds.length > 0 &&
      branchIds.every((id) => id === s.branchId)
    );
  }

  /// La entidad está asignada a mi sede aunque sea compartida — habilita
  /// acciones locales: turno del coach, horario/sala de la clase en mi sede.
  function isAtMyBranch(branchIds: string[]): boolean {
    const s = session.value;
    if (s?.role === 'ADMIN') return true;
    return (
      s?.role === 'MANAGER' &&
      !!s.branchId &&
      branchIds.includes(s.branchId)
    );
  }

  function logout(): void {
    session.value = null;
    navigateTo('/login');
  }

  return {
    session,
    isAuthenticated,
    login,
    logout,
    canEditBranch,
    canEditInBranches,
    isAtMyBranch,
  };
}
