import type { H3Event } from 'h3';

import { useAdmin } from './firebase-admin';

export type StaffRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST';

export interface StaffContext {
  uid: string;
  email: string;
  role: StaffRole;
  branchId: string | null;
}

/// Verifica el Bearer token de Firebase Auth y carga /staff/{uid}.
/// Misma fuente de verdad que firestore.rules.
export async function requireStaff(event: H3Event): Promise<StaffContext> {
  const header = getHeader(event, 'authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    throw createError({ statusCode: 401, message: 'Token requerido' });
  }

  const { auth, db } = useAdmin();
  let uid: string;
  let email = '';
  try {
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email ?? '';
  } catch {
    throw createError({ statusCode: 401, message: 'Token inválido' });
  }

  const snap = await db.collection('staff').doc(uid).get();
  if (!snap.exists || snap.data()?.active === false) {
    throw createError({ statusCode: 403, message: 'No eres staff' });
  }
  const data = snap.data() ?? {};
  return {
    uid,
    email,
    role: (data.role as StaffRole) ?? 'RECEPTIONIST',
    branchId: (data.branch_id as string | null) ?? null,
  };
}

/// Verifica el Bearer token de Firebase Auth — cualquier usuario válido
/// (socio de la app), sin requerir doc en /staff.
export async function requireUser(
  event: H3Event,
): Promise<{ uid: string; email: string }> {
  const header = getHeader(event, 'authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    throw createError({ statusCode: 401, message: 'Token requerido' });
  }
  try {
    const decoded = await useAdmin().auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? '' };
  } catch {
    throw createError({ statusCode: 401, message: 'Token inválido' });
  }
}

export function requireAdmin(staff: StaffContext) {
  if (staff.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Solo admin global' });
  }
}

/// El caller debe operar en `branchId` salvo que sea ADMIN.
export function requireBranchScope(staff: StaffContext, branchId: string | null | undefined) {
  if (staff.role === 'ADMIN') return;
  if (!branchId || staff.branchId !== branchId) {
    throw createError({ statusCode: 403, message: 'Fuera de tu sede' });
  }
}
