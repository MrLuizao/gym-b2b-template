import type { SupportMessage } from '#shared/types';

import { db } from '../../../utils/db';
import { requireMember } from '../../../utils/member-auth';
import { requireStaff } from '../../../utils/staff-auth';

/// Lista mensajes de una conversación — socio o staff según auth.
export default defineEventHandler(async (event): Promise<SupportMessage[]> => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID requerido' });
  }

  const convRef = db().collection('conversations').doc(id);
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    throw createError({ statusCode: 404, message: 'Conversación no encontrada' });
  }
  const conv = convSnap.data()!;

  // Intentar auth como staff primero, si falla como socio
  let isMember = false;
  try {
    const staff = await requireStaff(event);
    // Staff debe tener acceso a la sede de la conversación
    if (staff.role !== 'ADMIN' && staff.branchId !== conv.branch_id) {
      throw createError({ statusCode: 403, message: 'Fuera de tu sede' });
    }
    // Marcar mensajes del socio como leídos
    await convRef.update({ unread_staff: 0 });
  } catch (e: unknown) {
    // Si no es staff, verificar que sea el socio dueño
    const member = await requireMember(event);
    if (member.id !== conv.member_id) {
      throw createError({ statusCode: 403, message: 'No es tu conversación' });
    }
    isMember = true;
    // Marcar mensajes del staff como leídos
    await convRef.update({ unread_member: 0 });
  }

  const snap = await convRef
    .collection('messages')
    .orderBy('created_at', 'asc')
    .limit(100)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      conversationId: id,
      sender: data.sender === 'staff' ? 'staff' : 'member',
      senderName: String(data.sender_name ?? ''),
      text: String(data.text ?? ''),
      createdAt: data.created_at?.toMillis?.() ?? Date.now(),
      read: data.read === true,
    } satisfies SupportMessage;
  });
});
