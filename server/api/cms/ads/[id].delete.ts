import { writeAdAudit } from '../../../utils/audit';
import { db } from '../../../utils/db';
import { requireAdmin, requireStaff } from '../../../utils/staff-auth';

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const staff = await requireStaff(event);
  requireAdmin(staff);
  const ref = db().collection('sponsorAds').doc(getRouterParam(event, 'id') ?? '');
  const snap = await ref.get();
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Anuncio no encontrado' });
  }

  const before = snap.data() ?? {};
  /// Anuncio comprado por self-serve:
  /// - EXPIRADO → borrado libre (el anunciante ya recibió lo que pagó).
  /// - PENDING → bloqueado: se rechaza desde la orden (reembolso).
  /// - VIGENTE → solo admin con razón obligatoria + snapshot en auditLogs.
  ///   El reembolso es decisión aparte (Stripe dashboard u otro canal).
  const orderId = (before.order_id as string | null) ?? null;
  if (orderId) {
    if (before.status === 'PENDING') {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Los anuncios pendientes se rechazan desde su orden (con reembolso) — no se borran directo',
      });
    }
    const endsAtMs =
      typeof before.ends_at?.toMillis === 'function'
        ? before.ends_at.toMillis()
        : 0;
    const expired = endsAtMs > 0 && endsAtMs <= Date.now();
    if (!expired) {
      const body =
        (await readBody<{ reason?: string }>(event).catch(() => null)) ?? {};
      const reason = String(body.reason ?? '').trim().slice(0, 300);
      if (!reason) {
        throw createError({
          statusCode: 400,
          statusMessage:
            'Este anuncio fue comprado — eliminarlo requiere una razón (queda en el log)',
        });
      }
      await writeAdAudit({
        adId: ref.id,
        orderId,
        advertiser: String(before.advertiser ?? ''),
        action: 'DELETE',
        staff,
        reason,
        snapshot: {
          title: before.title ?? '',
          subtitle: before.subtitle ?? '',
          placement: before.placement ?? 'carousel',
          status: before.status ?? '',
          branch_id: before.branch_id ?? null,
          ends_at: before.ends_at ?? null,
          impressions: before.impressions ?? 0,
          taps: before.taps ?? 0,
        },
      });
    }
  }

  await ref.delete();
  return { ok: true };
});
