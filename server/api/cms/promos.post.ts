import { Timestamp } from 'firebase-admin/firestore';

import type { PromoBanner } from '#shared/types';

import { db, toPromo } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<PromoBanner> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);

  const body = await readBody<{
    title?: string;
    subtitle?: string;
    badge?: string;
    imageUrl?: string;
    branchId?: string | null;
  }>(event);

  if (!body?.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'El título es obligatorio' });
  }

  const ref = db().collection('promotions').doc();
  await ref.set({
    type: 'banner',
    title: String(body.title).slice(0, 80),
    subtitle: String(body.subtitle ?? '').slice(0, 140),
    badge: String(body.badge ?? 'NUEVO').slice(0, 12),
    image_url:
      String(body.imageUrl || `https://picsum.photos/seed/${ref.id}/900/400`),
    branch_id: body.branchId || null,
    created_at: Timestamp.now(),
    expires_at: null,
  });
  return toPromo(await ref.get());
});
