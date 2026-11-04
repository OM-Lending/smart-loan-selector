import 'server-only';
import { z } from 'zod';

export function notificationEnvironment() {
  const value = process.env.NOTIFICATION_ENVIRONMENT ?? process.env.VERCEL_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  // A mail setting must never prevent the business transaction from saving.
  return ['production', 'preview', 'development'].includes(value) ? value : 'development';
}

export function emailConfiguration() {
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true') return null;
  if (process.env.NOTIFICATION_ENVIRONMENT && !['production', 'preview', 'development'].includes(process.env.NOTIFICATION_ENVIRONMENT)) return null;
  const apiKey = process.env.BREVO_API_KEY;
  const sender = z.string().email().safeParse(process.env.EMAIL_FROM_ADDRESS);
  const recipients = [...new Set((process.env.ADMIN_NOTIFICATION_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))];
  const origin = z.string().url().safeParse(process.env.APP_BASE_URL);
  if (!apiKey || !sender.success || !origin.success || !recipients.length || recipients.length > 10 || recipients.some(email => !z.string().email().safeParse(email).success)) return null;
  const base = new URL(origin.data);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
  return { apiKey, sender: sender.data, senderName: process.env.EMAIL_FROM_NAME?.trim() || 'OpenLending', recipients, baseUrl: base.origin };
}

export async function sendBrevoEmail(config: NonNullable<ReturnType<typeof emailConfiguration>>, message: { recipient: string; subject: string; html: string; idempotencyKey: string }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12_000),
    headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: config.senderName, email: config.sender }, to: [{ email: message.recipient }],
      subject: message.subject, htmlContent: message.html,
      headers: { idempotencyKey: message.idempotencyKey },
    }),
  });
  const body = await response.json().catch(() => null) as { messageId?: string; code?: string } | null;
  // A duplicate key means Brevo already accepted this delivery recently.
  if (!response.ok && body?.code === 'duplicate_parameter') return null;
  if (!response.ok) throw new Error(`BREVO_HTTP_${response.status}${body?.code ? `:${body.code.slice(0, 80)}` : ''}`);
  if (!body?.messageId) throw new Error('BREVO_MISSING_MESSAGE_ID');
  return body.messageId;
}
