import { db } from '../../../utils/db';
import { requireAdmin, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const ref = db().collection('sponsorAds').doc(getRouterParam(event, 'id') ?? '');
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }
  await ref.delete();
  return { ok: true };
});
