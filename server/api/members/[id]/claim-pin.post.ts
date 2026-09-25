import { db } from '../../../utils/db';
import { generateClaimPin, sendClaimPinEmail } from '../../../utils/mail';
import { requireBranchScope, requireStaff } from '../../../utils/staff-auth';

/// Recepción regenera el PIN de activación (socio que perdió el correo
/// o alta antigua sin PIN) — se reenvía a `contact_email` y también se
/// devuelve en la respuesta para dictarlo en mostrador.
export default defineEventHandler(
  async (event): Promise<{ claimPin: string; emailSent: boolean }> => {
    const staff = await requireStaff(event);
    const id = getRouterParam(event, 'id') ?? '';
    const doc = await db().collection('users').doc(id).get();
    if (!doc.exists) {
      throw createError({ statusCode: 404, statusMessage: 'Socio no encontrado' });
    }
    const data = doc.data() ?? {};
    requireBranchScope(staff, (data.branch_id as string) ?? null);

    if (data.auth_uid) {
      throw createError({
        statusCode: 409,
        statusMessage: 'La cuenta ya está vinculada — el PIN solo sirve para el primer acceso',
      });
    }
    const contactEmail = data.contact_email as string | undefined;
    if (!contactEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'El socio no tiene correo de contacto registrado',
      });
    }

    const claimPin = generateClaimPin();
    await doc.ref.update({ claim_pin: claimPin });

    let emailSent = false;
    try {
      emailSent = await sendClaimPinEmail({
        to: contactEmail,
        name: (data.name as string) ?? '',
        memberNumber: (data.member_number as string) ?? '',
        pin: claimPin,
      });
    } catch (err) {
      console.warn('[mail] fallo al reenviar PIN:', err);
    }
    return { claimPin, emailSent };
  },
);
