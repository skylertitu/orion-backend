import nodemailer from 'nodemailer';
import { logger } from './logger';

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getAppUrl(): string {
  return (process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
}

export function isDevResetLinkEnabled(): boolean {
  if (process.env.PASSWORD_RESET_RETURN_LINK === 'true') return true;
  if (process.env.PASSWORD_RESET_RETURN_LINK === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendOrionPasswordResetEmail(options: {
  to: string;
  resetUrl: string;
  googleAccount: boolean;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const googleNote = options.googleAccount
    ? '<p>Esta cuenta también puede entrar con <strong>Continuar con Google</strong>.</p>'
    : '';

  try {
    await transporter.sendMail({
      from: `"AutoTrade" <${from}>`,
      to: options.to,
      subject: 'Recuperar contraseña — AutoTrade',
      text: [
        'Recibimos una solicitud para restablecer tu contraseña de AutoTrade.',
        '',
        `Abre este enlace (válido 1 hora): ${options.resetUrl}`,
        options.googleAccount ? 'Esta cuenta también puede entrar con Continuar con Google.' : '',
        '',
        'Si no fuiste tú, ignora este correo.',
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2>Recuperar contraseña</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña de AutoTrade.</p>
          ${googleNote}
          <p><a href="${escapeHtml(options.resetUrl)}" style="display:inline-block;background:#eab308;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Restablecer contraseña</a></p>
          <p style="font-size:12px;color:#555">El enlace caduca en 1 hora. Si no fuiste tú, ignora este correo.</p>
        </div>
      `,
    });
    logger.info(`[mail] Correo de recuperación AutoTrade enviado a ${options.to}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[mail] No se pudo enviar el correo de AutoTrade a ${options.to}: ${message}`);
    return false;
  }
}

export async function sendOrionVerifyEmail(options: { to: string; verifyUrl: string }): Promise<boolean> {
  if (!isSmtpConfigured()) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"AutoTrade" <${from}>`,
      to: options.to,
      subject: 'Validar cuenta — AutoTrade',
      text: `Confirma tu correo de AutoTrade con este enlace (válido 24 horas): ${options.verifyUrl}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2>Validar cuenta</h2>
          <p>Confirma que este correo es tuyo para validar tu cuenta de AutoTrade.</p>
          <p><a href="${escapeHtml(options.verifyUrl)}" style="display:inline-block;background:#eab308;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Validar correo</a></p>
          <p style="font-size:12px;color:#555">El enlace caduca en 24 horas.</p>
        </div>
      `,
    });
    logger.info(`[mail] Correo de validación enviado a ${options.to}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[mail] No se pudo enviar validación a ${options.to}: ${message}`);
    return false;
  }
}

export async function sendFirebasePasswordResetEmail(email: string): Promise<boolean> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    return false;
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    if (!res.ok) {
      const msg = body.error?.message || res.statusText;
      if (msg.includes('EMAIL_NOT_FOUND')) {
        logger.info(`[mail] Firebase: no hay usuario Auth para ${email} (cuenta solo local)`);
        return false;
      }
      logger.error(`[mail] Firebase no pudo enviar el correo de recuperación: ${msg}`);
      return false;
    }
    logger.info(`[mail] Firebase envió el correo de recuperación a ${email}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[mail] Error al llamar a Firebase sendOobCode: ${message}`);
    return false;
  }
}
