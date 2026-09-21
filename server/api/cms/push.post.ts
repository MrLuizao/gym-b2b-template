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
    }>(event);

    const title = body?.title?.trim();
    const message = body?.body?.trim() ?? '';
    if (!title || !body?.body?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Título y cuerpo son obligatorios',
      });
    }

    const audience = body.audience ?? 'ALL';
    const branchId = body.branchId || null;

    let sent = 0;
    if (audience === 'ALL') {
      sent = 1248;
    } else if (audience === 'EXPIRED') {
      sent = db.members.filter((m) => m.membershipStatus === 'EXPIRED').length * 37;
    } else {
      sent = 180 + Math.floor(Math.random() * 220);
    }

    const log: PushLog = {
      id: randomUUID(),
      title,
      body: message,
      audience,
      branchId,
      sent,
      createdAt: Date.now(),
    };
    db.pushes.unshift(log);
    return log;
  },
);
