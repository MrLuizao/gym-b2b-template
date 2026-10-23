import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import { defineEventHandler, getQuery, getHeader, readBody } from 'h3';
import type { ChurnFeatures } from '#shared/types';
import { getBusinessFeatures } from '../../utils/config';

const TZ = 'America/Mexico_City';

function getLocalDateString(date: Date): string {
  const local = new Date(date.toLocaleString('en-US', { timeZone: TZ }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const d = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Cron Job para extracción y cálculo de features de churn de los socios activos.
 * Lee de las colecciones canónicas (users, users/visits, bookings, conversations).
 * Escribe en `users/{id}/churn_features/{fecha}` y actualiza `latest_churn_features` en el usuario.
 */
export default defineEventHandler(async (event) => {
  const db = getFirestore();

  // 1. Validar si el módulo está habilitado
  const featuresConfig = await getBusinessFeatures();
  if (
    !featuresConfig.ai_churn_prediction?.enabled ||
    !featuresConfig.ai_churn_prediction?.settings?.daily_batch
  ) {
    return { success: true, skipped: true, reason: 'Modulo de IA Churn deshabilitado en configuracion' };
  }

  // 2. Validación de seguridad para cron
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = getHeader(event, 'authorization');
    const query = getQuery(event);
    let bodySecret = '';
    try {
      const b = await readBody(event);
      bodySecret = b?.secret || '';
    } catch {
      // Ignorar si el request no trajo body (GET de Vercel Cron)
    }

    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const provided = bearer || (query?.secret as string) || bodySecret;

    if (provided !== cronSecret) {
      throw createError({ statusCode: 401, statusMessage: 'Cron secret no autorizado' });
    }
  }

  const now = new Date();
  const todayKey = getLocalDateString(now);

  const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 86_400_000);
  const thirtyDaysAgoKey = getLocalDateString(thirtyDaysAgoDate);

  // 3. Obtener socios activos
  const membersSnap = await db
    .collection('users')
    .where('membership_status', '==', 'ACTIVE')
    .get();

  if (membersSnap.empty) {
    return { success: true, processed: 0, message: 'No hay socios activos registrados' };
  }

  let batch = db.batch();
  let opCount = 0;
  let processed = 0;

  for (const doc of membersSnap.docs) {
    const memberId = doc.id;
    const member = doc.data();

    // A. Visitas de los últimos 30 días (`users/{id}/visits`)
    const visitsSnap = await db
      .collection('users')
      .doc(memberId)
      .collection('visits')
      .where(FieldPath.documentId(), '>=', thirtyDaysAgoKey)
      .get();

    const visitDates: string[] = [];
    const uniqueBranches = new Set<string>();

    for (const vDoc of visitsSnap.docs) {
      visitDates.push(vDoc.id);
      const bId = vDoc.get('branch_id');
      if (bId) uniqueBranches.add(bId);
    }

    // Calcular distribución semanal (4 semanas de 7 días)
    const visitsByBucket = [0, 0, 0, 0];
    for (const dStr of visitDates) {
      const d = new Date(dStr);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
      const bucketIdx = Math.min(Math.floor(diffDays / 7), 3);
      if (bucketIdx >= 0 && bucketIdx < 4) {
        visitsByBucket[bucketIdx] = (visitsByBucket[bucketIdx] ?? 0) + 1;
      }
    }

    const totalVisitsLast4 = visitsByBucket.reduce((a, b) => a + b, 0);
    const avgVisits = totalVisitsLast4 / 4;

    const visitsVariance =
      visitsByBucket.reduce((sum, v) => sum + Math.pow(v - avgVisits, 2), 0) / 4;

    // Días desde última visita
    let daysSinceLastVisit = 99;
    if (member.last_checkin_at) {
      const lastDate = member.last_checkin_at.toDate
        ? member.last_checkin_at.toDate()
        : new Date(member.last_checkin_at);
      daysSinceLastVisit = Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / 86_400_000));
    } else if (visitDates.length > 0) {
      visitDates.sort();
      const latestDateStr = visitDates[visitDates.length - 1];
      if (latestDateStr) {
        const latestDate = new Date(latestDateStr);
        daysSinceLastVisit = Math.max(0, Math.floor((now.getTime() - latestDate.getTime()) / 86_400_000));
      }
    }

    // B. Reservas y cancelaciones de clases últimos 30 días
    let cancellationRate = 0;
    const classTypes = new Set<string>();

    try {
      const bookingsSnap = await db
        .collection('bookings')
        .where('auth_uid', '==', memberId)
        .where('class_date', '>=', thirtyDaysAgoKey)
        .get();

      if (!bookingsSnap.empty) {
        let cancelled = 0;
        for (const b of bookingsSnap.docs) {
          const bData = b.data();
          if (bData.status === 'cancelled') {
            cancelled++;
          } else {
            if (bData.class_id) classTypes.add(bData.class_id);
          }
        }
        cancellationRate = cancelled / bookingsSnap.size;
      }
    } catch {
      // Ignorar fallback si falta índice en bookings
    }

    // C. Tickets de soporte recientes
    let supportTickets = 0;
    try {
      const convSnap = await db
        .collection('conversations')
        .where('member_id', '==', memberId)
        .get();
      supportTickets = convSnap.size;
    } catch {
      supportTickets = 0;
    }

    // D. Fricción de pagos
    const hasPaymentLate = false;

    // E. Meses activo
    let membershipMonthsActive = 1;
    if (member.created_at) {
      const createdDate = member.created_at.toDate
        ? member.created_at.toDate()
        : new Date(member.created_at);
      membershipMonthsActive = Math.max(
        1,
        Math.floor((now.getTime() - createdDate.getTime()) / (30 * 86_400_000)),
      );
    }

    const calculatedFeatures: ChurnFeatures = {
      avg_visits_per_week_last_4: Math.round(avgVisits * 100) / 100,
      visits_variance: Math.round(visitsVariance * 100) / 100,
      days_since_last_visit: daysSinceLastVisit,
      class_cancellation_rate: Math.round(cancellationRate * 100) / 100,
      unique_branches_visited: Math.max(uniqueBranches.size, 1),
      active_class_types_count: classTypes.size,
      has_payment_late_30d: hasPaymentLate,
      support_tickets_last_30d: supportTickets,
      goal_streak_current: Number(member.goal_streak ?? 0),
      weekly_goal: Number(member.weekly_goal ?? 4),
      points_balance: Number(member.points ?? 0),
      membership_months_active: membershipMonthsActive,
      scored_at: now.toISOString(),
    };

    // Guardar en subcolección histórica
    const featureDocRef = db
      .collection('users')
      .doc(memberId)
      .collection('churn_features')
      .doc(todayKey);
    batch.set(featureDocRef, calculatedFeatures);
    opCount++;

    // Denormalizar en el doc del usuario para lecturas rápidas sin N subqueries
    const memberDocRef = db.collection('users').doc(memberId);
    batch.update(memberDocRef, {
      latest_churn_features: calculatedFeatures,
      churn_features_calculated_at: now.toISOString(),
    });
    opCount++;

    processed++;

    if (opCount >= 400) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return {
    success: true,
    processed,
    timestamp: now.toISOString(),
  };
});
