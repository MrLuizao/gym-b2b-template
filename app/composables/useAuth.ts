import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

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
  /// La cookie es solo caché del doc staff/{uid} — bindSessionToFirebase la
  /// reescribe con datos vivos en cada cambio y la limpia al cerrar sesión.
  /// maxAge largo: la vida real la marca Firebase Auth, no el reloj.
  const session = useCookie<StaffSession | null>('cf_b2b_session', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 30,
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

  /// La sesión es un espejo de Firebase Auth + staff/{uid}, no una copia
  /// congelada al login: onSnapshot re-lee el doc cada vez que cambia en
  /// Firestore (rol, sede, nombre) y actualiza la cookie en vivo.
  /// Sin usuario Firebase autenticado la cookie se limpia — una cookie
  /// vieja nunca puede simular una sesión que el backend rechazaría.
  function bindSessionToFirebase(): () => void {
    const firebase = useFirebase();
    if (!firebase.enabled || !firebase.app || !firebase.db) {
      return () => {};
    }
    const auth = getAuth(firebase.app);
    const db = firebase.db;
    let stopStaff: (() => void) | null = null;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopStaff?.();
      stopStaff = null;
      if (!user) {
        session.value = null;
        return;
      }
      stopStaff = onSnapshot(
        doc(db, 'staff', user.uid),
        async (snap) => {
          const staff = snap.data();
          if (!snap.exists() || !staff || staff.active === false) {
            session.value = null;
            return;
          }
          const branchId = (staff.branch_id as string | null) ?? null;
          let branchName: string | null = null;
          if (branchId) {
            const branchSnap = await getDoc(doc(db, 'branches', branchId));
            branchName =
              (branchSnap.data()?.name as string | undefined) ?? null;
          }
          session.value = {
            email: user.email ?? '',
            name:
              (staff.name as string | undefined) ??
              deriveName(user.email ?? 'staff'),
            role: (staff.role as StaffRole) ?? 'RECEPTIONIST',
            branchId,
            branchName,
          };
        },
        /// Error de permiso/red: conservamos la cookie — el backend sigue
        /// siendo quien autoriza; no sacamos al usuario por ruido.
        () => {},
      );
    });
    return () => {
      stopAuth();
      stopStaff?.();
    };
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
    bindSessionToFirebase,
    canEditBranch,
    canEditInBranches,
    isAtMyBranch,
  };
}
