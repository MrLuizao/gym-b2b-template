import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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
  RECEPTIONIST: ['/', '/recepcion', '/socios', '/clases', '/entrenadores', '/membresias'],
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
    if (firebase.enabled && firebase.app && firebase.db) {
      const auth = getAuth(firebase.app);
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);

      /// El rol y la sede salen del doc staff/{uid} — fuente de verdad.
      const staffSnap = await getDoc(
        doc(firebase.db, 'staff', cred.user.uid),
      );
      if (!staffSnap.exists() || staffSnap.data().active === false) {
        await signOut(auth);
        throw new Error('Esta cuenta no es staff del negocio');
      }
      const staff = staffSnap.data();
      const staffRole = (staff.role as StaffRole) ?? 'RECEPTIONIST';
      const branchId = (staff.branch_id as string | null) ?? null;

      let branchName: string | null = null;
      if (branchId) {
        const branchSnap = await getDoc(
          doc(firebase.db, 'branches', branchId),
        );
        branchName = (branchSnap.data()?.name as string | undefined) ?? null;
      }

      session.value = {
        email,
        name: (staff.name as string | undefined) ?? deriveName(email),
        role: staffRole,
        branchId,
        branchName,
      };
      return;
    }

    if (!email.includes('@') || password.length < 4) {
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

  async function logout(): Promise<void> {
    const firebase = useFirebase();
    if (firebase.enabled && firebase.app) {
      await signOut(getAuth(firebase.app));
    }
    session.value = null;
    await navigateTo('/login');
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
