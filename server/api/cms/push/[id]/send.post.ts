import type { PushLog } from '#shared/types';
import { PROMO_OPT_IN_RATE, TOTAL_DEVICES, useMockDb } from '../../../../utils/mock-db';

export default defineEventHandler(
  async (event): Promise<PushLog> => {
    const db = useMockDb();
    const id = getRouterParam(event, 'id');
    const log = db.pushes.find((p) => p.id === id);
    if (!log) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Notificación no encontrada',
      });
    }
    /// Mock: simula el alcance del envío por audiencia y opt-in de aliados.
    /// Reenviar una notificación ya enviada actualiza su fecha y alcance.
    let sent = 0;
    if (log.audience === 'ALL') {
      sent = TOTAL_DEVICES;
    } else if (log.audience === 'EXPIRED') {
      sent = db.members.filter((m) => m.membershipStatus === 'EXPIRED').length * 37;
    } else {
      sent = 180 + Math.floor(Math.random() * 220);
    }
    if (log.kind === 'SPONSOR') {
      sent = Math.round(sent * PROMO_OPT_IN_RATE);
    }

    log.status = 'SENT';
    log.sent = sent;
    log.createdAt = Date.now();
    return log;
  },
);
