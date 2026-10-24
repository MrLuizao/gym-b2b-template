import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import type { ChurnFeatures, ChurnRiskLevel, RetentionPlaybookId } from '#shared/types';
import { predictChurnScikitLearn } from './churn-model';

export interface VertexPredictionResult {
  probability: number;
  riskLevel: ChurnRiskLevel;
  topFactors: string[];
  suggestedPlaybook: RetentionPlaybookId;
  provider: 'vertex_ai' | 'sklearn_local';
  scoredAt: string;
  rawScore?: number;
}

export interface VertexConfig {
  projectId: string;
  location: string;
  endpointId: string;
}

function getServiceAccountCredentials(): Record<string, any> | undefined {
  try {
    const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (fromEnv) return JSON.parse(fromEnv);
    const file = resolve(process.cwd(), 'service-account.json');
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

let authClient: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!authClient) {
    const creds = getServiceAccountCredentials();
    authClient = new GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  return authClient;
}

/**
 * Obtiene token de acceso OAuth2 para llamar al Vertex AI REST API.
 */
async function getVertexAccessToken(): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error('No se pudo obtener el token de acceso para Vertex AI');
  }
  return tokenResponse.token;
}

/**
 * Prueba la conectividad con el endpoint de Vertex AI.
 */
export async function testVertexConnection(config: VertexConfig): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const token = await getVertexAccessToken();
    const url = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/endpoints/${config.endpointId}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        message: `Vertex AI HTTP ${res.status}: ${errText}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      message: `Conexión exitosa a endpoint: ${data.displayName || config.endpointId}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error desconocido al conectar con Vertex AI',
    };
  }
}

/**
 * Realiza la inferencia contra un endpoint de Vertex AI AutoML Tabular.
 * Si Vertex AI no está disponible o falla, hace fallback transparente al modelo local Scikit-Learn.
 */
export async function predictChurnVertexAI(
  features: ChurnFeatures,
  config: VertexConfig,
): Promise<VertexPredictionResult> {
  if (!config.projectId || !config.endpointId) {
    console.warn('[Vertex AI] Configuración incompleta. Usando modelo local scikit-learn.');
    const fallback = predictChurnScikitLearn(features);
    return { ...fallback, provider: 'sklearn_local' };
  }

  try {
    const token = await getVertexAccessToken();
    const location = config.location || 'us-central1';
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${location}/endpoints/${config.endpointId}:predict`;

    // Normalizar features en el formato esperado por Vertex AutoML Tabular
    const instance = {
      avg_visits_per_week_last_4: Number(features.avg_visits_per_week_last_4 || 0),
      visits_variance: Number(features.visits_variance || 0),
      days_since_last_visit: Number(features.days_since_last_visit || 0),
      class_cancellation_rate: Number(features.class_cancellation_rate || 0),
      unique_branches_visited: Number(features.unique_branches_visited || 1),
      active_class_types_count: Number(features.active_class_types_count || 0),
      has_payment_late_30d: features.has_payment_late_30d ? 'true' : 'false',
      support_tickets_last_30d: Number(features.support_tickets_last_30d || 0),
      goal_streak_current: Number(features.goal_streak_current || 0),
      weekly_goal: Number(features.weekly_goal || 4),
      points_balance: Number(features.points_balance || 0),
      membership_months_active: Number(features.membership_months_active || 0),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [instance],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Vertex AI Error ${response.status}]`, errorText);
      console.warn('[Vertex AI] Fallback a modelo scikit-learn local');
      return { ...predictChurnScikitLearn(features), provider: 'sklearn_local' };
    }

    const result = await response.json();
    const prediction = result.predictions?.[0];

    let probability = 0.5;

    // Manejar formato AutoML Tabular: { classes: ['0', '1'], scores: [0.2, 0.8] } o { value: 0.8 }
    if (prediction && Array.isArray(prediction.classes) && Array.isArray(prediction.scores)) {
      const churnIndex = prediction.classes.findIndex((c: any) => String(c) === '1' || String(c).toLowerCase() === 'true');
      if (churnIndex >= 0) {
        probability = prediction.scores[churnIndex] ?? 0.5;
      }
    } else if (typeof prediction?.scores?.[1] === 'number') {
      probability = prediction.scores[1];
    } else if (typeof prediction === 'number') {
      probability = prediction;
    }

    let riskLevel: ChurnRiskLevel = 'low';
    if (probability >= 0.65) {
      riskLevel = 'high';
    } else if (probability >= 0.35) {
      riskLevel = 'medium';
    }

    // Usar la lógica de factores de atribución
    const localAnalysis = predictChurnScikitLearn(features);

    return {
      probability: Math.round(probability * 1000) / 1000,
      riskLevel,
      topFactors: localAnalysis.topFactors,
      suggestedPlaybook: localAnalysis.suggestedPlaybook,
      provider: 'vertex_ai',
      scoredAt: new Date().toISOString(),
      rawScore: probability,
    };
  } catch (err) {
    console.error('[Vertex AI Exception]', err);
    console.warn('[Vertex AI] Fallback automático a scikit-learn local');
    return { ...predictChurnScikitLearn(features), provider: 'sklearn_local' };
  }
}
