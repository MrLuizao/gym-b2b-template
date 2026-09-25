import nodemailer, { type Transporter } from 'nodemailer';

/// SMTP genérico por env — en dev funciona con Gmail (app password) o
/// Brevo; en prod se apunta al proveedor real sin tocar código.
/// Sin SMTP_* configurado el envío se omite y el PIN se loguea en
/// consola del server (fallback dev — el B2B lo muestra igual).
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  });
  return transporter;
}

export function generateClaimPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/// Correo de activación: código de 6 dígitos + links de descarga.
/// Regresa true si el proveedor aceptó el envío.
export async function sendClaimPinEmail(opts: {
  to: string;
  name: string;
  memberNumber: string;
  pin: string;
}): Promise<boolean> {
  const iosUrl = process.env.APP_IOS_URL || 'https://apps.apple.com';
  const androidUrl =
    process.env.APP_ANDROID_URL || 'https://play.google.com/store';
  const from =
    process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@gym.local';
  const firstName = opts.name.split(' ')[0] ?? opts.name;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;background:#0d0f14;color:#e8eaf0;padding:32px;border-radius:16px">
      <h2 style="margin:0 0 8px">¡Bienvenido, ${firstName}!</h2>
      <p style="color:#9aa0ae;font-size:14px;line-height:1.5">
        Tu inscripción quedó lista. Este es tu número de socio y tu
        código de activación — los necesitas la primera vez que entres
        a la app.
      </p>
      <div style="background:#161a22;border:1px solid #262b36;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
        <p style="margin:0;color:#9aa0ae;font-size:11px;letter-spacing:2px">NÚMERO DE SOCIO</p>
        <p style="margin:4px 0 16px;font-size:22px;font-weight:800;letter-spacing:3px">${opts.memberNumber}</p>
        <p style="margin:0;color:#9aa0ae;font-size:11px;letter-spacing:2px">CÓDIGO DE ACTIVACIÓN</p>
        <p style="margin:4px 0 0;font-size:32px;font-weight:900;letter-spacing:8px;color:#c8f04a">${opts.pin}</p>
      </div>
      <p style="color:#9aa0ae;font-size:14px;line-height:1.5">
        Descarga la app e ingresa con Google o Apple — después escribe
        tu número y código para vincular tu cuenta.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${iosUrl}" style="display:inline-block;background:#c8f04a;color:#0d0f14;font-weight:800;font-size:13px;text-decoration:none;padding:12px 20px;border-radius:10px;margin:4px">Descargar para iOS</a>
        <a href="${androidUrl}" style="display:inline-block;background:#c8f04a;color:#0d0f14;font-weight:800;font-size:13px;text-decoration:none;padding:12px 20px;border-radius:10px;margin:4px">Descargar para Android</a>
      </div>
      <p style="color:#5a6070;font-size:11px;line-height:1.5">
        El código es de un solo uso. Si no solicitaste este registro,
        ignora este correo.
      </p>
    </div>`;

  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP no configurado — PIN de ${opts.memberNumber}: ${opts.pin} (para ${opts.to})`,
    );
    return false;
  }
  await t.sendMail({
    from,
    to: opts.to,
    subject: `${opts.memberNumber} — tu código de activación`,
    html,
  });
  return true;
}
