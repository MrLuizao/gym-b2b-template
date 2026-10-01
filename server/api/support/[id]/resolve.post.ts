import { db } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

/// Staff cierra/resuelve la conversación — se borra el doc y sus mensajes.
export default defineEventHandler(async (event): Promise<{ ok: boolean }> => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID requerido' });
  }

  const staff = await requireStaff(event);

  const convRef = db().collection('conversations').doc(id);
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    throw createError({ statusCode: 404, message: 'Conversación no encontrada' });
  }
  const conv = convSnap.data()!;

  if (staff.role !== 'ADMIN' && staff.branchId !== conv.branch_id) {
    throw createError({ statusCode: 403, message: 'Fuera de tu sede' });
  }

  // Borrar mensajes y conversación (historial solo de activas)
  const messages = await convRef.collection('messages').get();
  const batch = db().batch();
  for (const msg of messages.docs) {
    batch.delete(msg.ref);
  }
  batch.delete(convRef);
  await batch.commit();

  return { ok: true };
});
