import { Timestamp } from 'firebase-admin/firestore';

import type { PushLog } from '#shared/types';

import { db, toPushLog } from '../../utils/db';
import { requireAdmin, requireStaff } from '../../utils/staff-auth';

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

  const body = await readBody<{
    title?: string;
    body?: string;
    audience?: PushLog['audience'];
    branchId?: string | null;
    kind?: PushLog['kind'];
    target?: PushLog['target'];
    scheduledAt?: number | null;
  }>(event);

  const title = body?.title?.trim();
  const message = body?.body?.trim() ?? '';
  if (!title || !message) {
    throw createError({ statusCode: 400, statusMessage: 'Título y cuerpo son obligatorios' });
  }

  /// La creación solo guarda el borrador — el envío es
  /// POST /api/cms/push/[id]/send.
  const ref = db().collection('pushLogs').doc();
  await ref.set({
    title,
    body: message,
    audience: body.audience ?? 'ALL',
    branch_id: body.branchId || null,
    kind: body.kind === 'SPONSOR' ? 'SPONSOR' : 'BRAND',
    target: PUSH_TARGETS.has(body.target as PushLog['target'])
      ? body.target
      : 'auto',
    status: 'DRAFT',
    scheduled_at:
      typeof body.scheduledAt === 'number' && body.scheduledAt > 0
        ? Timestamp.fromMillis(body.scheduledAt)
        : null,
    sent: 0,
    created_at: Timestamp.now(),
  });
  return toPushLog(await ref.get());
});
