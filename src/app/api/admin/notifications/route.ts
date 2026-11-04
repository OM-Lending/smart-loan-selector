import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';
import { isSameOriginRequest } from '@/server/lib/request-origin';
import { emailConfiguration, notificationEnvironment } from '@/server/services/notifications/email-provider';
import { tryAdminNotifications } from '@/server/services/notifications/notification.service';

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;
  const page = z.coerce.number().int().min(1).max(10000).safeParse(new URL(request.url).searchParams.get('page') ?? 1);
  if (!page.success) return NextResponse.json({ error: 'Invalid page.' }, { status: 400 });
  const where = { environment: notificationEnvironment() };
  const [items, total] = await Promise.all([
    prisma.notificationEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page.data - 1) * 25, take: 25, include: { deliveries: { orderBy: { recipientEmail: 'asc' } } } }),
    prisma.notificationEvent.count({ where }),
  ]);
  return NextResponse.json({ items, total, configured: Boolean(emailConfiguration()), environment: where.environment }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = z.object({ eventId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid notification.' }, { status: 400 });
  if (!emailConfiguration()) return NextResponse.json({ error: 'Configure and enable email notifications first.' }, { status: 400 });
  const event = await prisma.notificationEvent.findFirst({ where: { id: parsed.data.eventId, environment: notificationEnvironment() }, select: { id: true } });
  if (!event) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  await prisma.notificationDelivery.updateMany({ where: { eventId: event.id, status: 'FAILED' }, data: { status: 'PENDING', nextAttemptAt: new Date(), attemptCount: 0, lastError: null } });
  after(() => tryAdminNotifications(event.id));
  return NextResponse.json({ success: true });
}
