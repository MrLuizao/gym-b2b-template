import type { PushLog } from '#shared/types';
import { useMockDb } from '../../../../utils/mock-db';

export default defineEventHandler(async (event): Promise<PushLog> => {
  const db = useMockDb();
  const id = getRouterParam(event, 'id');
  const log = db.pushes.find((item) => item.id === id);
  if (!log) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Notificación no encontrada',
    });
  }
  const body = await readBody<{
    title?: string;
    body?: string;
    audience?: PushLog['audience'];
    branchId?: string | null;
    kind?: PushLog['kind'];
    scheduledAt?: number | null;
  }>(event);

  if (body?.title !== undefined && body.title.trim()) {
    log.title = body.title.trim().slice(0, 80);
  }
  if (body?.body !== undefined && body.body.trim()) {
    log.body = body.body.trim().slice(0, 240);
  }
  if (body?.audience !== undefined) {
    log.audience = ['ALL', 'BRANCH', 'EXPIRED'].includes(body.audience)
      ? body.audience
      : 'ALL';
  }
  if (body?.branchId !== undefined) log.branchId = body.branchId || null;
  if (body?.kind !== undefined) {
    log.kind = body.kind === 'SPONSOR' ? 'SPONSOR' : 'BRAND';
  }
  if (body?.scheduledAt !== undefined) {
    log.scheduledAt =
      typeof body.scheduledAt === 'number' && body.scheduledAt > 0
        ? body.scheduledAt
        : null;
  }

  return log;
});
