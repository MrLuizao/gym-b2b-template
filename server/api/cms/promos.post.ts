import type { PromoBanner } from '#shared/types';
import { randomUUID } from 'node:crypto';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(async (event): Promise<PromoBanner> => {
  const db = useMockDb();
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

  const promo: PromoBanner = {
    id: randomUUID(),
    title: String(body.title).slice(0, 80),
    subtitle: String(body.subtitle ?? '').slice(0, 140),
    badge: String(body.badge ?? 'NUEVO').slice(0, 12),
    imageUrl: String(body.imageUrl || `https://picsum.photos/seed/${randomUUID()}/900/400`),
    branchId: body.branchId || null,
    createdAt: Date.now(),
  };
  db.promos.unshift(promo);
  return promo;
});
