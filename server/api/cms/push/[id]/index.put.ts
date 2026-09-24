import { Timestamp } from 'firebase-admin/firestore';

import type { PushLog } from '#shared/types';

import { db, toPushLog } from '../../../../utils/db';
import { requireAdmin, requireStaff } from '../../../../utils/staff-auth';

const PUSH_TARGETS = new Set<PushLog['target']>([
  'auto',
  'home',
  'explore',
  'allies',
  'promos',
  'profile',
]);

export default defineEventHandler(async (event): Promise<PushLog> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const id = getRouterParam(event, 'id') ?? '';

  const ref = db().collection('pushLogs').doc(id);
  if (!(await ref.get()).exists) {
    throw createError({ statusCode: 404, statusMessage: 'Notificación no encontrada' });
  }

  const body = await readBody<{
    title?: string;
    body?: string;
    audience?: PushLog['audience'];
    branchId?: string | null;
    kind?: PushLog['kind'];
    target?: PushLog['target'];
    scheduledAt?: number | null;
  }>(event);

  const update: Record<string, unknown> = {};
  if (body?.title !== undefined && body.title.trim()) update.title = body.title.trim().slice(0, 80);
  if (body?.body !== undefined && body.body.trim()) update.body = body.body.trim().slice(0, 240);
  if (body?.audience !== undefined) {
    update.audience = ['ALL', 'BRANCH', 'EXPIRED'].includes(body.audience) ? body.audience : 'ALL';
  }
  if (body?.branchId !== undefined) update.branch_id = body.branchId || null;
  if (body?.kind !== undefined) update.kind = body.kind === 'SPONSOR' ? 'SPONSOR' : 'BRAND';
  if (body?.target !== undefined) {
    update.target = PUSH_TARGETS.has(body.target) ? body.target : 'auto';
  }
  if (body?.scheduledAt !== undefined) {
    update.scheduled_at =
      typeof body.scheduledAt === 'number' && body.scheduledAt > 0
        ? Timestamp.fromMillis(body.scheduledAt)
        : null;
  }

  if (Object.keys(update).length > 0) await ref.update(update);
  return toPushLog(await ref.get());
});
