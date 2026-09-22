import type { PushLog } from '#shared/types';
import { randomUUID } from 'node:crypto';
import { useMockDb } from '../../utils/mock-db';

export default defineEventHandler(
  async (event): Promise<PushLog> => {
    const db = useMockDb();
    const body = await readBody<{
      title?: string;
      body?: string;
      audience?: PushLog['audience'];
      branchId?: string | null;
      kind?: PushLog['kind'];
      scheduledAt?: number | null;
    }>(event);

    const title = body?.title?.trim();
    const message = body?.body?.trim() ?? '';
    if (!title || !body?.body?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Título y cuerpo son obligatorios',
      });
    }

    /// La creación solo guarda el borrador — el envío es un paso aparte
    /// (POST /api/cms/push/[id]/send).
    const log: PushLog = {
      id: randomUUID(),
      title,
      body: message,
      audience: body.audience ?? 'ALL',
      branchId: body.branchId || null,
      kind: body.kind === 'SPONSOR' ? 'SPONSOR' : 'BRAND',
      status: 'DRAFT',
      scheduledAt:
        typeof body.scheduledAt === 'number' && body.scheduledAt > 0
          ? body.scheduledAt
          : null,
      sent: 0,
      createdAt: Date.now(),
    };
    db.pushes.unshift(log);
    return log;
  },
);
