import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

const Params = z.object({ id: z.string().uuid() });
const UpdateBody = z.object({
  reviewStatus: z.enum(['IN_REVIEW', 'NEEDS_INFORMATION', 'READY_TO_SUBMIT']),
  brokerNote: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const parsed = Params.safeParse(await context.params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });

  const application = await prisma.application.findFirst({
    where: { id: parsed.data.id, user: { deletedAt: null } },
    select: {
      id: true,
      goal: true,
      currentStage: true,
      propertyPostcode: true,
      purchasePrice: true,
      deposit: true,
      propertyValue: true,
      currentLoanBalance: true,
      createdAt: true,
      user: { select: { fullName: true, email: true, phone: true } },
      continuation: {
        include: {
          selectedQuote: { select: { id: true, lenderName: true, productName: true, quotedRate: true, quotedRateType: true, quotedRepayment: true } },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      },
    },
  });

  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (!application.continuation || application.continuation.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'This application has not been submitted for broker review' }, { status: 409 });
  }

  const continuation = application.continuation;
  return NextResponse.json({
    application: {
      id: application.id,
      goal: application.goal,
      currentStage: application.currentStage,
      propertyPostcode: application.propertyPostcode,
      purchasePrice: application.purchasePrice?.toString() ?? null,
      deposit: application.deposit?.toString() ?? null,
      propertyValue: application.propertyValue?.toString() ?? null,
      currentLoanBalance: application.currentLoanBalance?.toString() ?? null,
      createdAt: application.createdAt.toISOString(),
      customer: application.user,
      continuation: {
        id: continuation.id,
        reviewStatus: continuation.reviewStatus,
        brokerNote: continuation.brokerNote,
        submittedAt: continuation.submittedAt?.toISOString() ?? null,
        details: continuation.details,
        selectedQuote: {
          ...continuation.selectedQuote,
          quotedRate: continuation.selectedQuote.quotedRate.toString(),
        },
        documents: continuation.documents.map(document => ({
          id: document.id,
          category: document.category,
          fileName: document.fileName,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          uploadedAt: document.uploadedAt.toISOString(),
        })),
      },
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const parsedId = Params.safeParse(await context.params);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
  const parsedBody = UpdateBody.safeParse(await request.json());
  if (!parsedBody.success) return NextResponse.json({ error: 'Invalid review update', details: parsedBody.error.flatten().fieldErrors }, { status: 400 });

  const { reviewStatus, brokerNote } = parsedBody.data;
  if (reviewStatus === 'NEEDS_INFORMATION' && !brokerNote?.trim()) {
    return NextResponse.json({ error: 'Add a note explaining what information is needed.' }, { status: 400 });
  }

  const continuation = await prisma.applicationContinuation.findFirst({
    where: { applicationId: parsedId.data.id, status: 'SUBMITTED', application: { currentStage: { in: ['BROKER_REVIEW', 'DOCUMENTS_PENDING'] } } },
    select: { id: true },
  });
  if (!continuation) return NextResponse.json({ error: 'Submitted application not found in the broker review queue' }, { status: 404 });

  const updated = await prisma.$transaction(async tx => {
    const updated = await tx.applicationContinuation.update({
      where: { id: continuation.id },
      data: {
        reviewStatus,
        brokerNote: brokerNote?.trim() || null,
      },
      select: { reviewStatus: true, brokerNote: true, updatedAt: true },
    });
    await tx.application.update({
      where: { id: parsedId.data.id },
      data: { currentStage: reviewStatus === 'NEEDS_INFORMATION' ? 'DOCUMENTS_PENDING' : 'BROKER_REVIEW' },
    });
    return updated;
  });

  return NextResponse.json({
    success: true,
    reviewStatus: updated.reviewStatus,
    brokerNote: updated.brokerNote,
    updatedAt: updated.updatedAt.toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
