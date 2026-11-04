import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';
import { isSameOriginRequest } from '@/server/lib/request-origin';
import { UpdateBrokerEnquiry } from '@/lib/validations/broker-enquiry';

const Params = z.object({ id: z.string().uuid() });
class UpdateError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;
  const parsed = Params.safeParse(await context.params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid enquiry id.' }, { status: 400 });
  const [enquiry, admins] = await Promise.all([
    prisma.brokerEnquiry.findUnique({ where: { id: parsed.data.id },
      select: { id: true, userId: true, fullName: true, email: true, phone: true, message: true, status: true, assignedToId: true, linkedApplicationId: true, createdAt: true, updatedAt: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { fullName: true, email: true } } } } } }),
    prisma.profile.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true, fullName: true, email: true }, orderBy: { fullName: 'asc' } }),
  ]);
  if (!enquiry) return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
  const applications = await prisma.application.findMany({
    where: { ...(enquiry.userId ? { userId: enquiry.userId } : { user: { email: enquiry.email, deletedAt: null } }), continuation: { isNot: null } },
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, goal: true, createdAt: true, continuation: { select: { selectedQuote: { select: { lenderName: true, productName: true } } } } },
  });
  return NextResponse.json({ enquiry, admins, applications }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const params = Params.safeParse(await context.params);
  const body = UpdateBrokerEnquiry.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success) return NextResponse.json({ error: !body.success ? body.error.issues[0].message : 'Invalid enquiry id.' }, { status: 400 });
  try {
    const data = body.data;
    const enquiry = await prisma.$transaction(async tx => {
      const existing = await tx.brokerEnquiry.findUnique({ where: { id: params.data.id } });
      if (!existing) throw new UpdateError('Enquiry not found.', 404);
      if (existing.updatedAt.toISOString() !== data.updatedAt) throw new UpdateError('This enquiry was updated by someone else. Reload before saving.', 409);
      const status = data.outcome && data.status === 'NEW' ? 'CONTACTING' : data.status;
      if (existing.status !== 'NEW' && status === 'NEW') throw new UpdateError('Choose Contacting customer to reopen an enquiry.', 400);
      const assignee = data.assignedToId ? await tx.profile.findFirst({ where: { id: data.assignedToId, role: 'ADMIN', deletedAt: null }, select: { fullName: true, email: true } }) : null;
      if (data.assignedToId && !assignee) throw new UpdateError('Choose an active administrator.', 400);
      if (data.linkedApplicationId) {
        const application = await tx.application.findFirst({ where: { id: data.linkedApplicationId, user: { deletedAt: null } }, select: { userId: true, user: { select: { email: true } }, continuation: { select: { id: true } } } });
        if (!application || (existing.userId ? application.userId !== existing.userId : application.user.email.toLowerCase() !== existing.email.toLowerCase())) throw new UpdateError('Choose an application belonging to this customer.', 400);
        if (status === 'CONVERTED' && !application.continuation) throw new UpdateError('The customer must start the continued application before this enquiry can be marked as proceeding.', 400);
      }
      const updated = await tx.brokerEnquiry.updateMany({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: { status, assignedToId: data.assignedToId, linkedApplicationId: data.linkedApplicationId, updatedAt: new Date() } });
      if (!updated.count) throw new UpdateError('This enquiry was updated by someone else. Reload before saving.', 409);
      const activities: Prisma.BrokerEnquiryActivityCreateManyInput[] = [];
      const base = { enquiryId: existing.id, actorId: access.identity.profile!.id };
      if (existing.status !== status) activities.push({ ...base, type: 'STATUS_CHANGED', fromStatus: existing.status, toStatus: status });
      if (existing.assignedToId !== data.assignedToId) activities.push({ ...base, type: 'ASSIGNED', note: assignee ? `Assigned to ${assignee.fullName ?? assignee.email}.` : 'Assignment removed.' });
      if (existing.linkedApplicationId !== data.linkedApplicationId) activities.push({ ...base, type: 'NOTE_ADDED', note: data.linkedApplicationId ? 'Linked to the selected loan application.' : 'Application link removed.' });
      if (data.channel && data.outcome) activities.push({ ...base, type: 'CONTACT_ATTEMPT', channel: data.channel, outcome: data.outcome, note: data.note || null });
      else if (data.note) activities.push({ ...base, type: 'NOTE_ADDED', note: data.note });
      if (activities.length) await tx.brokerEnquiryActivity.createMany({ data: activities });
      return tx.brokerEnquiry.findUniqueOrThrow({ where: { id: existing.id }, select: { updatedAt: true } });
    }, { timeout: 15_000 });
    return NextResponse.json({ success: true, updatedAt: enquiry.updatedAt });
  } catch (error) {
    if (error instanceof UpdateError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Broker enquiry update failed.');
    return NextResponse.json({ error: 'Could not update this enquiry.' }, { status: 500 });
  }
}
