import type { H3Event } from 'h3';

import { verifyAppCheck } from './app-check';
import { useAdmin } from './firebase-admin';

export interface MemberContext {
  uid: string;
  id: string;
  name: string;
  branchId: string;
}

/// Verifica el Bearer token de Firebase Auth y carga el doc del socio
/// vinculado a ese auth_uid. Rechaza si no hay doc vinculado.
export async function requireMember(event: H3Event): Promise<MemberContext> {
  await verifyAppCheck(event);
  const header = getHeader(event, 'authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    throw createError({ statusCode: 401, message: 'Token requerido' });
  }

  const { auth, db } = useAdmin();
  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw createError({ statusCode: 401, message: 'Token inválido' });
  }

  // Buscar el doc del socio vinculado a este auth_uid
  const snap = await db
    .collection('users')
    .where('auth_uid', '==', uid)
    .limit(1)
    .get();

  if (snap.empty) {
    throw createError({
      statusCode: 403,
      message: 'No tienes cuenta de socio vinculada',
    });
  }

  const doc = snap.docs[0]!;
  const data = doc.data();
  return {
    uid,
    id: doc.id,
    name: String(data.name ?? ''),
    branchId: String(data.branch_id ?? ''),
  };
}
