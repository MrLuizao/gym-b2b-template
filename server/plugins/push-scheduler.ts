import { dispatchDuePushLogs } from '../utils/push';

/// Scheduler en proceso — despacha pushLogs programados cada 30 s.
/// Funciona en cualquier servidor Node de larga vida; en despliegues
/// serverless no corre continuo — usar POST /api/cms/push/dispatch
/// desde un cron externo (GitHub Actions, cron-job.org).
export default defineNitroPlugin(() => {
  /// Desactivado por ahora — las notificaciones se envían manualmente.
  /// Reactivar con PUSH_SCHEDULER=1 cuando la programación vuelva.
  if (process.env.PUSH_SCHEDULER !== '1') return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await dispatchDuePushLogs();
    } catch (error) {
      console.error('[push-scheduler]', error);
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(tick, 30_000);
});
