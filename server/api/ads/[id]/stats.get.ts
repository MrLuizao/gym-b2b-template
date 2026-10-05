import { FieldPath } from 'firebase-admin/firestore';

import { db } from '../../../utils/db';
import { requireStaff } from '../../../utils/staff-auth';

const TZ = 'America/Mexico_City';
const DAYS = 30;

export interface AdDailyStat {
  date: string;
  impressions: number;
  taps: number;
}

/// GET /api/ads/{id}/stats — serie diaria (30d) de impresiones/taps
/// únicos por socio para reportes a patrocinadores. Solo admin/gerente —
/// es información comercial.
export default defineEventHandler(
  async (event): Promise<{ days: AdDailyStat[] }> => {
    const staff = await requireStaff(event);
    if (staff.role === 'RECEPTIONIST') {
      throw createError({ statusCode: 403, statusMessage: 'Sin acceso' });
    }
    const adId = String(getRouterParam(event, 'id') ?? '');

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    const start = new Date(Date.now() - (DAYS - 1) * 86_400_000);

    const snap = await db()
      .collection('adStats')
      .where(FieldPath.documentId(), '>=', `${adId}_${fmt(start)}`)
      .where(FieldPath.documentId(), '<=', `${adId}_${fmt(new Date())}`)
      .get();

    const byDate = new Map(
      snap.docs.map((d) => [
        String(d.data().date ?? ''),
        {
          impressions: Number(d.data().impressions ?? 0),
          taps: Number(d.data().taps ?? 0),
        },
      ]),
    );

    /// Serie completa — los días sin eventos quedan en 0 para que la
    /// gráfica no comprima el tiempo.
    const days: AdDailyStat[] = [];
    for (let i = 0; i < DAYS; i++) {
      const date = fmt(new Date(start.getTime() + i * 86_400_000));
      const stat = byDate.get(date) ?? { impressions: 0, taps: 0 };
      days.push({ date, ...stat });
    }
    return { days };
  },
);
