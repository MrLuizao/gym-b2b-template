/// Análisis de sentimiento y detección de quejas en mensajes de soporte.
/// Primario: Gemini en JSON mode. Respaldo: palabras clave (sin key o si
/// Gemini falla / responde algo inválido).

import type { ComplaintType } from '#shared/types';

import { generateWithGemini } from './gemini';

export type { ComplaintType };

export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  complaint_type: ComplaintType;
  severity: number; // 0-1
  ai_powered: boolean;
}

const COMPLAINT_TYPES: ComplaintType[] = [
  'precio',
  'aforo',
  'staff',
  'instalaciones',
  'horarios',
  'general',
  'ninguna',
];

/// Frases (no palabras sueltas) para minimizar falsos positivos —
/// p. ej. "limpio" o "espera" solas no son queja.
const COMPLAINT_KEYWORDS: Record<Exclude<ComplaintType, 'ninguna' | 'general'>, string[]> = {
  precio: ['muy caro', 'esta caro', 'está caro', 'demasiado caro', 'subieron el precio', 'aumentó el precio', 'aumento el precio', 'muy costoso', 'no vale lo que'],
  aforo: ['siempre lleno', 'muy lleno', 'está lleno', 'esta lleno', 'no hay lugar', 'no hay espacio', 'no cabe', 'mucha gente', 'hacer fila', 'esperar las máquinas', 'esperar las maquinas'],
  staff: ['coach malo', 'entrenador malo', 'mal servicio', 'mala atención', 'mala atencion', 'grosero', 'grosera', 'incompetente', 'me trataron mal', 'no me atendieron'],
  instalaciones: ['equipo roto', 'máquina rota', 'maquina rota', 'no sirve', 'descompuesta', 'descompuesto', 'sucio', 'sucia', 'huele mal', 'sin agua', 'no hay agua caliente', 'aire no funciona'],
  horarios: ['horario malo', 'abren tarde', 'abre tarde', 'cierran temprano', 'cierra temprano', 'cancelaron la clase', 'no hay clases', 'cambiaron el horario'],
};

const GENERAL_NEGATIVE = ['queja', 'molesto', 'molesta', 'decepcionado', 'decepcionada', 'pésimo', 'pesimo', 'cancelar mi membresía', 'cancelar mi membresia', 'darme de baja'];
const POSITIVE_WORDS = ['excelente', 'genial', 'gracias', 'me encanta', 'muy bien', 'feliz', 'contento', 'contenta'];

/// Clasificador determinista por palabras clave (respaldo).
export function analyzeSentimentKeywords(message: string): SentimentAnalysis {
  const lower = message.toLowerCase();

  let maxScore = 0;
  let detected: ComplaintType = 'ninguna';
  let negativeScore = 0;

  for (const [type, phrases] of Object.entries(COMPLAINT_KEYWORDS)) {
    const score = phrases.reduce((n, p) => (lower.includes(p) ? n + 1 : n), 0);
    negativeScore += score;
    if (score > maxScore) {
      maxScore = score;
      detected = type as ComplaintType;
    }
  }

  const generalScore = GENERAL_NEGATIVE.reduce((n, p) => (lower.includes(p) ? n + 1 : n), 0);
  negativeScore += generalScore;
  if (detected === 'ninguna' && generalScore > 0) detected = 'general';

  const positiveScore = POSITIVE_WORDS.reduce((n, p) => (lower.includes(p) ? n + 1 : n), 0);

  let sentiment: SentimentAnalysis['sentiment'] = 'neutral';
  if (negativeScore > positiveScore) sentiment = 'negative';
  else if (positiveScore > negativeScore) sentiment = 'positive';

  // Una queja positiva neta (p. ej. "gracias, ya no está sucio") no cuenta.
  if (sentiment !== 'negative') detected = 'ninguna';

  const severity = detected === 'ninguna' ? 0 : Math.min((maxScore + generalScore) / 3, 1);

  return { sentiment, complaint_type: detected, severity, ai_powered: false };
}

/// Clasificador principal: Gemini con fallback a palabras clave.
export async function analyzeSentiment(message: string): Promise<SentimentAnalysis> {
  const system =
    'Clasificas mensajes de socios de un gimnasio en México enviados al chat de soporte. ' +
    'Responde SOLO JSON: {"sentiment":"positive|negative|neutral","complaint_type":"precio|aforo|staff|instalaciones|horarios|general|ninguna","severity":number}. ' +
    'complaint_type="ninguna" si no es una queja (dudas, saludos, agradecimientos). ' +
    'severity 0-1: 0 sin queja, 0.3 molestia leve, 0.6 queja clara, 1 amenaza de cancelar o enojo fuerte.';

  const raw = await generateWithGemini(`Mensaje: """${message.slice(0, 1000)}"""`, system, true);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SentimentAnalysis>;
      const type = COMPLAINT_TYPES.includes(parsed.complaint_type as ComplaintType)
        ? (parsed.complaint_type as ComplaintType)
        : null;
      const sentiment =
        parsed.sentiment === 'positive' || parsed.sentiment === 'negative' || parsed.sentiment === 'neutral'
          ? parsed.sentiment
          : null;
      const severity = Number(parsed.severity);
      if (type && sentiment && Number.isFinite(severity)) {
        return {
          sentiment,
          complaint_type: type,
          severity: type === 'ninguna' ? 0 : Math.min(Math.max(severity, 0), 1),
          ai_powered: true,
        };
      }
    } catch {
      // JSON inválido → respaldo
    }
  }

  return analyzeSentimentKeywords(message);
}
