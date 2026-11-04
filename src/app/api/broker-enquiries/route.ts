import { after, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { isSameOriginRequest } from '@/server/lib/request-origin';
import { CreateBrokerEnquiry } from '@/lib/validations/broker-enquiry';
import { enqueueAdminNotification, tryAdminNotifications } from '@/server/services/notifications/notification.service';

export const runtime = 'nodejs';
export const maxDuration = 60;
class EnquiryRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return NextResponse.json({ error: 'Your message is too long.' }, { status: 413 });
    const parsed = CreateBrokerEnquiry.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { requestId, website, ...contact } = parsed.data;
    if (website) return NextResponse.json({ error: 'Could not submit your message.' }, { status: 400 });
    const secret = process.env.BROKER_ENQUIRY_RATE_LIMIT_SECRET ?? process.env.CLERK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: 'Contact requests are temporarily unavailable.' }, { status: 503 });
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const hash = (value: string) => createHmac('sha256', secret).update(`broker-enquiry:${value}`).digest('hex');
    const ipHash = hash(ip);
    const identity = await getAuthenticatedProfile();
    const result = await prisma.$transaction(async tx => {
      // Database locks make these limits work across serverless instances.
      for (const key of [hash(contact.email), ipHash].sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const previous = await tx.brokerEnquiry.findUnique({ where: { requestId } });
      if (previous) {
        if (previous.email !== contact.email || previous.fullName !== contact.fullName || previous.phone !== contact.phone || previous.message !== contact.message) throw new EnquiryRequestError('This submission has changed. Close the form and try again.', 409);
        return previous;
      }
      const since = new Date(Date.now() - 15 * 60_000);
      const [emailCount, ipCount] = await Promise.all([
        tx.brokerEnquiry.count({ where: { email: contact.email, createdAt: { gte: since } } }),
        tx.brokerEnquiry.count({ where: { requestIpHash: ipHash, createdAt: { gte: since } } }),
      ]);
      if (emailCount >= 3 || ipCount >= 10) throw new EnquiryRequestError('Too many messages. Please try again in 15 minutes.', 429);
      const enquiry = await tx.brokerEnquiry.create({ data: {
        ...contact, requestId, requestIpHash: ipHash, userId: identity?.profile?.id,
        activities: { create: { type: 'CREATED', toStatus: 'NEW' } },
      } });
      await enqueueAdminNotification(tx, { key: `enquiry.created:${enquiry.id}`, type: 'BROKER_ENQUIRY_CREATED', enquiryId: enquiry.id });
      return enquiry;
    }, { maxWait: 5000, timeout: 15_000 });
    const event = await prisma.notificationEvent.findFirst({ where: { enquiryId: result.id }, select: { id: true } }).catch(() => null);
    if (event) after(() => tryAdminNotifications(event.id));
    return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid message format.' }, { status: 400 });
    if (error instanceof EnquiryRequestError) return NextResponse.json({ error: error.message }, { status: error.status, ...(error.status === 429 ? { headers: { 'Retry-After': '900' } } : {}) });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Your request is already being processed. Please retry in a moment.' }, { status: 409 });
    console.error('Broker enquiry could not be saved.');
    return NextResponse.json({ error: 'Could not send your message. Your entries are still available in this form. Please retry.' }, { status: 500 });
  }
}
