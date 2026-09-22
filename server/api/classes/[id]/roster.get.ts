import type { Member } from '#shared/types';
import { useMockDb } from '../../../utils/mock-db';

export default defineEventHandler((event): Member[] => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const gymClass = db.classes.find((c) => c.id === id);
  if (!gymClass) {
    throw createError({ statusCode: 404, statusMessage: 'Clase no encontrada' });
  }

  /// Mock: los inscritos son socios activos de las sedes donde se imparte
  /// la clase, hasta cubrir el cupo reservado.
  return db.members
    .filter(
      (m) =>
        gymClass.branchIds.includes(m.branchId) &&
        m.membershipStatus === 'ACTIVE',
    )
    .slice(0, gymClass.booked);
});
