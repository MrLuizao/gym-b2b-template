import type {
  ChurnRiskLevel,
  RetentionPlaybookId,
  SupportIntent,
} from '#shared/types';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_TIMEOUT_MS = 4500;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Llama a la API REST de Google Gemini con timeout corto.
 * Retorna `null` si no hay `GEMINI_API_KEY` o si la llamada falla, permitiendo
 * que el caller use un fallback contextual determinista sin romper el flujo.
 */
export async function generateWithGemini(
  prompt: string,
  systemInstruction?: string,
  jsonMode = false,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 320,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface RetentionMessageContext {
  memberName: string;
  daysSinceLastVisit: number;
  avgVisitsPerWeek: number;
  points: number;
  weeklyGoal: number;
  playbook: RetentionPlaybookId;
  action: 'push' | 'ticket' | 'bonus_push';
  topFactors: string[];
}

export function buildFallbackRetentionMessage(ctx: RetentionMessageContext): {
  title: string;
  message: string;
} {
  const firstName = ctx.memberName.split(' ')[0] || 'Socio';

  switch (ctx.playbook) {
    case 'streak_rescue':
      if (ctx.action === 'bonus_push') {
        return {
          title: `🔥 ¡Bono de rescate +25 pts para ti, ${firstName}!`,
          message: `Hola ${firstName}, abonamos +25 pts de impulso a tu cuenta (tienes ${ctx.points + 25} pts). Regresa esta semana por tus ${ctx.weeklyGoal} visitas y desbloquea +50 pts extra.`,
        };
      }
      return {
        title: `🔥 ¡No dejes enfriar tus ${ctx.points} puntos, ${firstName}!`,
        message: `Hola ${firstName}, llevas ${ctx.daysSinceLastVisit} días sin visitarnos. Estás muy cerca de canjear una recompensa con tus ${ctx.points} pts acumulados. ¡Te esperamos hoy!`,
      };

    case 'schedule_unlock':
      return {
        title: `📅 Mejores horarios disponibles para ti, ${firstName}`,
        message: `Hola ${firstName}, notamos que varias de tus reservas recientes se cancelaron. ¿Te ayudamos a encontrar un horario con más cupo en tus clases favoritas esta semana?`,
      };

    case 'payment_assist':
      return {
        title: `💳 Apoyo con tu membresía, ${firstName}`,
        message: `Hola ${firstName}, queremos asegurarnos de que no tengas ningún inconveniente con tu membresía ni pierdas tus ${ctx.points} puntos acumulados. ¿Te apoyamos desde recepción?`,
      };

    case 'human_care':
      return {
        title: `👋 Seguimiento personal de tu sede`,
        message: `Hola ${firstName}, te escribimos de gerencia porque hace ${ctx.daysSinceLastVisit} días no te vemos y queremos saber si todo estuvo bien en tus últimas visitas o si podemos mejorar algo para ti.`,
      };

    case 'habit_boost':
    default:
      return {
        title: `💪 ¡Retoma tu ritmo hoy, ${firstName}!`,
        message: `Hola ${firstName}, hace ${ctx.daysSinceLastVisit} días no entrenas con nosotros. Una sesión de 35 minutos hoy basta para reactivar tu meta semanal de ${ctx.weeklyGoal} días.`,
      };
  }
}

export async function generateRetentionPlaybookMessage(
  ctx: RetentionMessageContext,
): Promise<{ title: string; message: string; aiPowered: boolean }> {
  const fallback = buildFallbackRetentionMessage(ctx);

  const systemPrompt =
    'Eres el asistente de retención de un gimnasio en México. Redacta en español mexicano natural, cálido, conciso y directo (sin exagerar signos ni sonar robótico). Responde únicamente en JSON con las llaves {"title": string, "message": string}. El title máximo 55 caracteres y el message máximo 210 caracteres.';

  const userPrompt = `Socio: ${ctx.memberName}
Días sin asistir: ${ctx.daysSinceLastVisit}
Promedio semanal último mes: ${ctx.avgVisitsPerWeek.toFixed(1)} visitas/sem (meta: ${ctx.weeklyGoal})
Puntos acumulados: ${ctx.points} pts
Causas de riesgo detectadas: ${ctx.topFactors.join(', ') || 'Baja asistencia reciente'}
Jugada seleccionada: ${ctx.playbook}
Canal: ${ctx.action === 'ticket' ? 'Mensaje directo de soporte/gerencia' : ctx.action === 'bonus_push' ? 'Notificación Push otorgando +25 puntos de bono de rescate hoy' : 'Notificación Push móvil'}`;

  const raw = await generateWithGemini(userPrompt, systemPrompt, true);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { title?: string; message?: string };
      if (parsed.title && parsed.message) {
        return {
          title: parsed.title.slice(0, 65),
          message: parsed.message.slice(0, 260),
          aiPowered: true,
        };
      }
    } catch {
      // Cae a fallback
    }
  }

  return { ...fallback, aiPowered: false };
}

export interface SupportCopilotInput {
  memberName: string;
  planName: string;
  membershipStatus: string;
  membershipUntil: string | null;
  points: number;
  goalStreak: number;
  weeklyGoal: number;
  churnRiskLevel: ChurnRiskLevel;
  daysSinceLastVisit: number;
  messages: Array<{ sender: 'member' | 'staff'; text: string }>;
}

export function classifySupportIntent(lastMemberMessage: string): {
  intent: SupportIntent;
  intentLabel: string;
  urgency: 'high' | 'normal';
} {
  const text = lastMemberMessage.toLowerCase();

  if (
    /queja|molest|mal servicio|cancelar|baja|reembolso|devolucion|sucio|groser|no sirve/.test(
      text,
    )
  ) {
    return { intent: 'complaint', intentLabel: '🚨 Queja / Retención', urgency: 'high' };
  }
  if (/pago|cobr|mensualidad|tarjeta|factura|venc|renov|precio|plan|cargo/.test(text)) {
    return { intent: 'billing', intentLabel: '💳 Cobro / Membresía', urgency: 'normal' };
  }
  if (/clase|spinning|yoga|box|horario|cupo|reserv|coach|entrenador/.test(text)) {
    return { intent: 'classes', intentLabel: '📅 Clases / Horarios', urgency: 'normal' };
  }
  if (/qr|acceso|entrar|pin|recompensa|punto|canje|codigo/.test(text)) {
    return { intent: 'access', intentLabel: '🔑 Acceso / Puntos', urgency: 'normal' };
  }
  return { intent: 'general', intentLabel: '💬 Consulta General', urgency: 'normal' };
}

export async function generateSupportCopilotSuggestions(
  input: SupportCopilotInput,
): Promise<{
  intent: SupportIntent;
  intentLabel: string;
  urgency: 'high' | 'normal';
  suggestions: string[];
  aiPowered: boolean;
}> {
  const lastMemberMsg =
    [...input.messages].reverse().find((m) => m.sender === 'member')?.text || '';
  const classification = classifySupportIntent(lastMemberMsg);
  if (input.churnRiskLevel === 'high') {
    classification.urgency = 'high';
  }

  const firstName = input.memberName.split(' ')[0] || 'hola';
  const untilLabel = input.membershipUntil || 'sin fecha registrada';

  const fallbackSuggestionsByIntent: Record<SupportIntent, string[]> = {
    billing: [
      `Hola ${firstName}, revisé tu ficha: tienes el plan ${input.planName} (${input.membershipStatus === 'ACTIVE' ? `vigente hasta el ${untilLabel}` : 'vencido'}). ¿Te apoyo con tu renovación o comprobante?`,
      `¡Con gusto, ${firstName}! Puedes renovar directamente en recepción o desde la app. Además tienes ${input.points} puntos acumulados en tu cuenta.`,
      `Hola ${firstName}, déjame validar el movimiento en caja de tu sede y te confirmo en un par de minutos.`,
    ],
    classes: [
      `Hola ${firstName}, recuerda que puedes reservar o liberar tu lugar desde la pestaña Explorar de la app hasta con 7 días de anticipación. ¿Qué clase buscas?`,
      `¡Hola ${firstName}! Si una clase aparece llena hoy, te recomiendo revisar 1 hora antes por lugares liberados o dime qué horario prefieres para ayudarte.`,
      `Con gusto reviso la disponibilidad de la clase en tu sede, ${firstName}. ¿Para qué día y hora te gustaría asistir?`,
    ],
    complaint: [
      `Hola ${firstName}, lamento mucho el inconveniente. Ya lo reporté con la gerencia de tu sede para atenderlo hoy mismo. ¿Nos das oportunidad de compensarte en tu próxima visita?`,
      `Gracias por avisarnos, ${firstName}. Para nosotros es prioridad que entrenes cómodo; el gerente de sede revisará tu caso personalmente.`,
      `Hola ${firstName}, entendemos tu molestia y queremos resolverlo de inmediato. ¿Prefieres que te marquemos o lo vemos hoy en recepción cuando nos visites?`,
    ],
    access: [
      `Hola ${firstName}, tu membresía ${input.planName} aparece ${input.membershipStatus === 'ACTIVE' ? `ACTIVA (vence el ${untilLabel})` : 'por renovar'} y cuentas con ${input.points} puntos disponibles.`,
      `¡Hola ${firstName}! Si tienes detalle con tu QR o código de canje, al llegar a recepción te damos acceso con tu número de socio sin problema.`,
      `Hola ${firstName}, tienes ${input.points} pts y racha de ${input.goalStreak} sem. Puedes generar tu código de recompensa en la pestaña Premios de la app.`,
    ],
    general: [
      `¡Hola ${firstName}! Te atendemos de recepción. Veo que tienes activo tu plan ${input.planName} (vence el ${untilLabel}). ¿En qué te podemos apoyar hoy?`,
      `Con gusto te ayudo, ${firstName}. También aprovecho para recordarte que tienes ${input.points} puntos acumulados en tu perfil.`,
      `Hola ${firstName}, ya estamos revisando tu solicitud en sede y te respondemos en un momento.`,
    ],
  };

  const historyText = input.messages
    .slice(-6)
    .map((m) => `${m.sender === 'member' ? 'Socio' : 'Recepción'}: ${m.text}`)
    .join('\n');

  const systemPrompt =
    'Eres el copiloto de atención a socios de un gimnasio en México. Genera exactamente 3 opciones de respuesta breves, amables y útiles para que recepción conteste con 1 click usando los datos reales del socio. Responde únicamente en JSON con el formato {"suggestions": [string, string, string]}. Cada respuesta debe tener máximo 190 caracteres.';

  const userPrompt = `Datos reales del socio:
- Nombre: ${input.memberName}
- Plan: ${input.planName} (${input.membershipStatus}, vence: ${untilLabel})
- Puntos de lealtad: ${input.points} pts (racha: ${input.goalStreak} semanas, meta: ${input.weeklyGoal}/sem)
- Días sin asistir: ${input.daysSinceLastVisit} (Riesgo de abandono: ${input.churnRiskLevel})

Historial reciente del chat:
${historyText || '(Conversación recién abierta)'}`;

  const raw = await generateWithGemini(userPrompt, systemPrompt, true);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { suggestions?: string[] };
      if (Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 2) {
        return {
          ...classification,
          suggestions: parsed.suggestions.slice(0, 3).map((s) => String(s).trim()),
          aiPowered: true,
        };
      }
    } catch {
      // Cae a fallback
    }
  }

  return {
    ...classification,
    suggestions: fallbackSuggestionsByIntent[classification.intent],
    aiPowered: false,
  };
}

export async function generateMemberCoachTip(input: {
  memberName: string;
  branchName: string;
  bestHourWindow: string;
  bestHourOccupancyPct: number;
  usualHourLabel: string;
  usualHourOccupancyPct: number;
  currentGoal: number;
  suggestedGoal: number | null;
  visitsThisWeek: number;
  streak: number;
}): Promise<{ tip: string; aiPowered: boolean }> {
  const firstName = input.memberName.split(' ')[0] || 'Atleta';
  const remaining = Math.max(0, input.currentGoal - input.visitsThisWeek);

  const crowdDiff = input.usualHourOccupancyPct - input.bestHourOccupancyPct;
  const crowdComp =
    crowdDiff >= 10 && input.usualHourLabel !== input.bestHourWindow.split(' ')[0]
      ? ` (vs ${input.usualHourOccupancyPct}% a las ${input.usualHourLabel})`
      : '';

  const fallbackTip =
    input.suggestedGoal && input.suggestedGoal < input.currentGoal
      ? `${firstName}, ajustar tu meta a ${input.suggestedGoal} días te ayudará a asegurar los +50 pts esta semana. Hoy entre ${input.bestHourWindow} entrenarás mucho más cómodo (${input.bestHourOccupancyPct}% de aforo).`
      : remaining === 0
        ? `¡Meta semanal cumplida, ${firstName}! Si entrenas hoy en ${input.branchName}, el horario de ${input.bestHourWindow} estará al ${input.bestHourOccupancyPct}% de capacidad.`
        : `${firstName}, te ${remaining === 1 ? 'falta 1 visita' : `faltan ${remaining} visitas`} para tus +50 pts. Si vas hoy entre ${input.bestHourWindow} tendrás ~${input.bestHourOccupancyPct}% de aforo${crowdComp}.`;

  const systemPrompt =
    'Eres el Coach IA personal dentro de la app móvil de un gimnasio en México. Escribe un consejo motivador, directo y ultra conciso (máximo 185 caracteres, 1 o 2 oraciones) combinando la mejor hora para entrenar hoy y su progreso de meta semanal.';

  const userPrompt = `Socio: ${firstName}
Sede: ${input.branchName}
Hora habitual: ${input.usualHourLabel} (${input.usualHourOccupancyPct}% aforo estimado)
Mejor ventana hoy: ${input.bestHourWindow} (${input.bestHourOccupancyPct}% aforo estimado)
Visitas esta semana: ${input.visitsThisWeek}/${input.currentGoal} (racha: ${input.streak} semanas)
Meta sugerida: ${input.suggestedGoal ? `${input.suggestedGoal} días/sem` : 'Mantener actual'}`;

  const raw = await generateWithGemini(userPrompt, systemPrompt, false);
  if (raw) {
    return {
      tip: raw.replace(/^["']|["']$/g, '').slice(0, 210),
      aiPowered: true,
    };
  }

  return { tip: fallbackTip, aiPowered: false };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function buildFallbackCoachReply(msg: string): string {
  const lower = msg.toLowerCase();

  if (
    lower.includes('calient') ||
    lower.includes('estir') ||
    lower.includes('activ') ||
    lower.includes('calentar')
  ) {
    return (
      '🔥 **Calentamiento dinámico recomendado (8-10 min):**\n\n' +
      '1. **Movilidad articular (3 min):** Rotaciones de tobillos, apertura de cadera y movilidad torácica con bandas.\n' +
      '2. **Activación muscular (3 min):** 2 series de 12 repeticiones de glute bridges, plancha frontal activa y sentadillas con peso corporal.\n' +
      '3. **Aproximación progresiva (4 min):** 2 series ligeras con la barra vacía o peso bajo antes de tu primera serie de trabajo.\n\n' +
      '¡Listo para entrenar con máxima potencia y sin riesgo de lesión!'
    );
  }

  if (
    lower.includes('comer') ||
    lower.includes('nutri') ||
    lower.includes('alimento') ||
    lower.includes('pre') ||
    lower.includes('post') ||
    lower.includes('prote') ||
    lower.includes('comida')
  ) {
    return (
      '🥗 **Guía de nutrición deportiva para tu sesión:**\n\n' +
      '• **Pre-entreno (30-60 min antes):** Carbohidratos de rápida absorción para energía inmediata (ej. 1 plátano con miel o crema de cacahuate, o avena con fruta) + 400ml de agua.\n' +
      '• **Post-entreno (dentro de las 2 hrs):** 20-30g de proteína de alta calidad (batido de suero, pollo o claras) + carbohidratos complejos para reparar tejido y recargar glucógeno.\n\n' +
      '¡La nutrición es el 50% de tu avance en el gym!'
    );
  }

  if (
    lower.includes('dolor') ||
    lower.includes('molest') ||
    lower.includes('lesi') ||
    lower.includes('espalda') ||
    lower.includes('rodilla') ||
    lower.includes('hombro')
  ) {
    return (
      '⚠️ **Atención prioritaria y seguridad:**\n\n' +
      'Si sientes un dolor punzante, ardor o pinchazo, **suspende el ejercicio de inmediato**.\n\n' +
      '• No intentes forzar repeticiones extras con dolor articular.\n' +
      '• Revisa tu alineación postural y reduce la carga a pesos que domines con técnica perfecta.\n' +
      '• Pide apoyo al coach de piso en tu sede para revisar tu técnica o acude con un fisioterapeuta si la molestia no cede.\n\n' +
      '¡Entrenar inteligente es la clave para la longevidad deportiva!'
    );
  }

  if (
    lower.includes('descanso') ||
    lower.includes('serie') ||
    lower.includes('tiempo') ||
    lower.includes('pausa')
  ) {
    return (
      '⏱️ **Tiempos de descanso según tu objetivo:**\n\n' +
      '• **Ejercicios multiarticulares pesados (Sentadilla, Peso Muerto, Press Banca):** 2 a 3 minutos para recuperación total del sistema nervioso.\n' +
      '• **Hipertrofia general (mancuernas y máquinas):** 60 a 90 segundos.\n' +
      '• **Aislamiento y bombeo final:** 45 a 60 segundos.\n\n' +
      'Usa el temporizador de tu reloj o celular para mantener el ritmo y no enfriarte.'
    );
  }

  if (
    lower.includes('rutina') ||
    lower.includes('ejercicio') ||
    lower.includes('pecho') ||
    lower.includes('espalda') ||
    lower.includes('pierna') ||
    lower.includes('brazo')
  ) {
    return (
      '🏋️ **Estructura recomendada para tu sesión:**\n\n' +
      '1. **Levantamiento principal (Fuerza):** 4 series de 6 a 8 repeticiones pesadas pero controladas.\n' +
      '2. **Accesorios principales (Hipertrofia):** 3 series de 10 a 12 repeticiones dejando 1-2 reps en reserva (RIR 1-2).\n' +
      '3. **Finalizador metabólico:** 2 a 3 series de 12-15 reps con énfasis en la contracción.\n\n' +
      '¡Enfócate en la sobrecarga progresiva y cuida siempre la fase excéntrica lenta (2-3 seg)!'
    );
  }

  return (
    '💪 ¡Gran iniciativa! La constancia y la técnica adecuada son la base de los verdaderos resultados. Recuerda mantenerte bien hidratado durante tu sesión y escuchar las señales de tu cuerpo.\n\n' +
    '¿Tienes alguna duda sobre tu rutina de hoy, técnica de algún movimiento o qué comer al terminar?'
  );
}

export async function generateCoachChatWithGemini(
  messages: ChatMessage[],
  systemInstruction?: string,
): Promise<{ reply: string; aiPowered: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.text || '';

  if (apiKey && messages.length > 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const contents = messages.map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 550,
        },
      };

      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = (await res.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return { reply: text, aiPowered: true };
        }
      }
    } catch {
      // Fallback contextual
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    reply: buildFallbackCoachReply(lastUserMsg),
    aiPowered: false,
  };
}
