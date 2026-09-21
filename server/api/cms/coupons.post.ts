import type { Coupon, MembershipLevel } from '#shared/types';
import { randomUUID } from 'node:crypto';
import { useMockDb } from '../../utils/mock-db';

const VALID_LEVELS = ['CLASSIC', 'PLUS', 'BLACK'];

export default defineEventHandler(async (event): Promise<Coupon> => {
  const db = useMockDb();
  const body = await readBody<{
    title?: string;
    description?: string;
    badge?: string;
    code?: string;
    levels?: string[];
    branchId?: string | null;
  }>(event);

  const title = body?.title?.trim();
  const code = body?.code?.trim();
  if (!title || !body?.code?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Título y código son obligatorios',
    });
  }

  const levels = (body.levels ?? [])
    .map((level) => String(level).toUpperCase())
    .filter((level): level is MembershipLevel =>
      (VALID_LEVELS as string[]).includes(level),
    );

  const couponLevels: (MembershipLevel | 'ALL')[] =
    levels.length > 0 ? levels : ['ALL'];

  const coupon: Coupon = {
    id: randomUUID(),
    title: title.slice(0, 80),
    description: (body.description ?? '').trim().slice(0, 140),
    badge: (body.badge ?? 'NUEVO').trim().slice(0, 12),
    code: body.code.trim().toUpperCase().slice(0, 16),
    levels: couponLevels,
    branchId: body.branchId || null,
    createdAt: Date.now(),
  };

  db.coupons.unshift(coupon);
  return coupon;
});
