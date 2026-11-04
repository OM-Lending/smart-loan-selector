import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma, NotificationType } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { buildAdminEmail } from './email-template';
import { emailConfiguration, notificationEnvironment, sendBrevoEmail } from './email-provider';

const MAX_DELIVERY_ATTEMPTS = 6;

// Two attempts per sending round, with a full day between rounds. These
// durations do not depend on the web server's or provider's calendar timezone.
function nextDeliveryAttempt(attempt: number, now = new Date()): Date | null {
  if (attempt >= MAX_DELIVERY_ATTEMPTS) return null;
  const delayMinutes = attempt % 2 === 0 ? 24 * 60 : 15;
  return new Date(now.getTime() + delayMinutes * 60_000);
}

function deliveryErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code.includes(':not_enough_credits')) return 'The email service has insufficient sending credits. Delivery will follow the scheduled retry policy; check the account allowance.';
  if (/^BREVO_HTTP_(401|403)/.test(code)) return 'Email service authorization needs attention. Check the API key and verified sender.';
  if (code.startsWith('BREVO_HTTP_429')) return 'The email service sending limit was reached. Sending will retry automatically.';
  if (code.startsWith('BREVO_HTTP_400')) return 'The email service rejected the message. Check the verified sender and recipient configuration.';
  if (code.startsWith('BREVO_HTTP_402')) return 'The email service account needs attention. Check available sending credits.';
  return 'Email delivery could not be completed. It will retry until the automatic retry limit is reached.';
}

export async function enqueueAdminNotification(tx: Prisma.TransactionClient, data: { key: string; type: NotificationType; applicationId?: string; enquiryId?: string }) {
  const environment = notificationEnvironment();
  const { key, ...source } = data;
  return tx.notificationEvent.upsert({
    where: { eventKey: `${environment}:${key}` }, update: {},
    create: { ...source, eventKey: `${environment}:${key}`, environment }, select: { id: true },
  });
}

export async function processAdminNotifications(eventId?: string, limit = 30) {
  const config = emailConfiguration();
  if (!config) return { configured: false, sent: 0, failed: 0 };
  const environment = notificationEnvironment();
  const now = new Date();
  const interrupted = await prisma.notificationDelivery.findMany({
    where: { status: 'PROCESSING', lockedUntil: { lte: now }, event: { environment } },
    select: { id: true, lockToken: true, attemptCount: true }, take: limit,
  });
  for (const delivery of interrupted) {
    await prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, status: 'PROCESSING', lockToken: delivery.lockToken, lockedUntil: { lte: now } },
      data: {
        status: 'FAILED', lockToken: null, lockedUntil: null,
        lastError: delivery.attemptCount >= MAX_DELIVERY_ATTEMPTS ? 'Retry limit reached after interrupted processing.' : 'Sending was interrupted. Delivery will follow the scheduled retry policy.',
        nextAttemptAt: nextDeliveryAttempt(delivery.attemptCount, now),
      },
    });
  }
  // Events without recipients stay durable until email configuration is available.
  const unexpanded = await prisma.notificationEvent.findMany({
    where: { environment, ...(eventId ? { id: eventId } : {}), deliveries: { none: {} } },
    orderBy: { createdAt: 'asc' }, take: limit, select: { id: true },
  });
  if (unexpanded.length) await prisma.notificationDelivery.createMany({
    // Make new deliveries due in this pass, rather than relying on a later
    // database default timestamp (or differences between server/DB clocks).
    data: unexpanded.flatMap(event => config.recipients.map(recipientEmail => ({ eventId: event.id, recipientEmail, nextAttemptAt: now }))), skipDuplicates: true,
  });
  const dispatchAt = new Date();
  const due: Prisma.NotificationDeliveryWhereInput = {
    status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: dispatchAt }, attemptCount: { lt: MAX_DELIVERY_ATTEMPTS },
  };
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { AND: [due, { event: { environment, ...(eventId ? { id: eventId } : {}) } }] },
    orderBy: { createdAt: 'asc' }, take: limit,
    include: { event: { include: { enquiry: true, application: { include: { user: true, continuation: { include: { selectedQuote: true } } } } } } },
  });
  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    const token = randomUUID();
    const claimed = await prisma.notificationDelivery.updateMany({
      where: { AND: [{ id: delivery.id }, due] },
      data: { status: 'PROCESSING', lockToken: token, lockedUntil: new Date(Date.now() + 120_000), attemptCount: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const email = buildAdminEmail(delivery.event, config.baseUrl);
      const providerMessageId = await sendBrevoEmail(config, { ...email, recipient: delivery.recipientEmail, idempotencyKey: delivery.id });
      await prisma.notificationDelivery.updateMany({ where: { id: delivery.id, lockToken: token }, data: {
        status: 'SENT', providerMessageId, sentAt: new Date(), lastError: null, nextAttemptAt: null, lockToken: null, lockedUntil: null,
      } });
      sent++;
    } catch (error) {
      const attempt = delivery.attemptCount + 1;
      // Keep provider responses and customer data out of error logs and UI.
      const message = deliveryErrorMessage(error);
      await prisma.notificationDelivery.updateMany({ where: { id: delivery.id, lockToken: token }, data: {
        status: 'FAILED', lastError: message, lockToken: null, lockedUntil: null,
        nextAttemptAt: nextDeliveryAttempt(attempt),
      } });
      failed++;
    }
  }
  return { configured: true, sent, failed };
}

/** Run after the HTTP response; the scheduled worker also recovers unfinished work. */
export async function tryAdminNotifications(eventId: string) {
  try {
    const result = await processAdminNotifications(eventId, 10);
    console.info('Admin notification processing completed.', { eventId, ...result });
  }
  catch { console.error('Admin notification processing deferred to the retry worker.'); }
}
