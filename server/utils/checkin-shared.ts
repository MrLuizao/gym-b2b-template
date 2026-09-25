import { Timestamp } from 'firebase-admin/firestore';

const TZ = 'America/Mexico_City';

/// TTL de un check-in: próximo cierre de la sede + 2h de margen.
/// Compartido por checkin de socios y de agregadores (partners).
export function closeExpiry(closeMinutes: number): Timestamp {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const localMinutes = local.getHours() * 60 + local.getMinutes();
  const closeLocal = new Date(local);
  closeLocal.setHours(Math.floor(closeMinutes / 60), closeMinutes % 60, 0, 0);
  if (localMinutes >= closeMinutes) closeLocal.setDate(closeLocal.getDate() + 1);
  const delta = closeLocal.getTime() - local.getTime();
  return Timestamp.fromMillis(now.getTime() + delta + 120 * 60_000);
}
