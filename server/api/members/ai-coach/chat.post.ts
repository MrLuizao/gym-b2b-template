import type { MemberAiCoachChatResponse } from '#shared/types';
import { db } from '../../../utils/db';
import { generateCoachChatWithGemini, type ChatMessage } from '../../../utils/gemini';
import { requireMember } from '../../../utils/member-auth';

export default defineEventHandler(async (event): Promise<MemberAiCoachChatResponse> => {
  const memberCtx = await requireMember(event);
  const body = await readBody<{
    message?: string;
    history?: ChatMessage[];
  }>(event);

  const rawMessage = (body?.message || '').trim();
  if (!rawMessage) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El mensaje no puede estar vacío.',
    });
  }

  // Cargar datos del socio y de su sede para contextualizar la respuesta
  const userRef = db().collection('users').doc(memberCtx.id);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  const firstName = String(userData.name || memberCtx.name || 'Socio').split(' ')[0];
  const branchId = String(userData.branch_id || memberCtx.branchId || '');

  let branchName = 'nuestro gimnasio';
  if (branchId) {
    const branchSnap = await db().collection('branches').doc(branchId).get();
    if (branchSnap.exists) {
      branchName = String(branchSnap.data()?.name || branchName);
    }
  }

  const weeklyGoal = Number(userData.weekly_goal ?? 4);

  const systemInstruction = `Eres el "Coach de Bolsillo", el asistente personal de entrenamiento y nutrición deportiva oficial de ${branchName}.
Estás conversando directamente con ${firstName}, socio del gimnasio (su meta semanal son ${weeklyGoal} días).

Reglas de conducta y estilo:
1. Habla en español en un tono motivador, enérgico, cercano y profesional (estilo coach de fitness moderno en México).
2. Respuestas concisas, prácticas y estructuradas para leerse rápidamente en un smartphone dentro del gym (usa negritas, viñetas cortas y emojis oportunos).
3. Especialízate en: calentamiento dinámico, técnica de levantamiento, tiempos de descanso, recuperación, hidratación y opciones prácticas de comida pre y post entrenamiento.
4. Seguridad ante todo: si el socio menciona dolor punzante, lesión o mareos, indícale de inmediato suspender el ejercicio, descansar y consultar al staff del gimnasio o a un médico. No diagnostiques patologías médicas.
5. Invita siempre a la acción y a mantener la constancia en ${branchName}.`;

  const history: ChatMessage[] = Array.isArray(body?.history)
    ? body.history
        .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
        .slice(-8)
        .map((h) => ({ role: h.role, text: h.text.trim() }))
    : [];

  history.push({ role: 'user', text: rawMessage });

  const result = await generateCoachChatWithGemini(history, systemInstruction);

  return {
    reply: result.reply,
    aiPowered: result.aiPowered,
  };
});
