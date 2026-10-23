import { getFirestore } from 'firebase-admin/firestore';

/// Registro de uso de features para facturación.
export interface FeatureUsage {
  month: string; // YYYY-MM
  business_id: string;
  feature: string; // 'ai_churn_prediction'
  plan: 'basic' | 'premium' | 'enterprise';
  active_members_count: number;
  predictions_made: number;
  cost_calculation: number;
  recorded_at: string;
}

/// Registra el uso diario de un feature.
export async function recordFeatureUsage(params: {
  feature: string;
  plan: 'basic' | 'premium' | 'enterprise';
  active_members_count: number;
  predictions_made: number;
}): Promise<void> {
  const db = getFirestore();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Costo por socio según plan
  const costPerMember = {
    basic: 0.01,
    premium: 0.03,
    enterprise: 0.05,
  };

  const cost = params.active_members_count * costPerMember[params.plan];

  // Upsert en la colección de uso
  const docRef = db.collection('usage_analytics').doc(`${month}_${params.feature}`);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data() as FeatureUsage;
    await docRef.update({
      predictions_made: data.predictions_made + params.predictions_made,
      cost_calculation: data.cost_calculation + cost,
      recorded_at: now.toISOString(),
    });
  } else {
    await docRef.set({
      month,
      business_id: 'rirhub', // TODO: multi-tenant
      feature: params.feature,
      plan: params.plan,
      active_members_count: params.active_members_count,
      predictions_made: params.predictions_made,
      cost_calculation: cost,
      recorded_at: now.toISOString(),
    });
  }
}

/// Obtiene el reporte de uso mensual.
export async function getMonthlyUsage(month: string, feature?: string): Promise<FeatureUsage[]> {
  const db = getFirestore();
  let query = db.collection('usage_analytics').where('month', '==', month);

  if (feature) {
    query = query.where('feature', '==', feature);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as FeatureUsage);
}
