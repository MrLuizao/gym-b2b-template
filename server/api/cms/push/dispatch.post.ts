import { dispatchDuePushLogs } from '../../../utils/push';

/// POST /api/cms/push/dispatch — para cron EXTERNO (GitHub Actions,
/// cron-job.org) en despliegues serverless donde el scheduler en proceso
/// no corre. Auth: header x-dispatch-secret = env PUSH_DISPATCH_SECRET.
export default defineEventHandler(async (event) => {
  const expected = process.env.PUSH_DISPATCH_SECRET;
  const secret = getHeader(event, 'x-dispatch-secret') ?? '';
  if (!expected || secret !== expected) {
    throw createError({ statusCode: 401, message: 'No autorizado' });
  }
  const dispatched = await dispatchDuePushLogs();
  return { dispatched };
});
