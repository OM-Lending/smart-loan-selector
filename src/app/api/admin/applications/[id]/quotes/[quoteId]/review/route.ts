import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

const ParamsSchema = z.object({ applicationId: z.string().uuid(), quoteId: z.string().uuid() });
const ReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string; quoteId: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const rawParams = await context.params;
  const parsedParams = ParamsSchema.safeParse({ applicationId: rawParams.id, quoteId: rawParams.quoteId });
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid application or match id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsedBody = ReviewSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid review', details: parsedBody.error.flatten().fieldErrors }, { status: 400 });
  }

  const quote = await prisma.applicationQuote.findFirst({
    where: { id: parsedParams.data.quoteId, applicationId: parsedParams.data.applicationId },
    select: { id: true },
  });
  if (!quote) return NextResponse.json({ error: 'Match not found for this application' }, { status: 404 });

  const review = await prisma.adminMatchReview.create({
    data: {
      quoteId: quote.id,
      reviewerProfileId: access.identity.profile!.id,
      decision: parsedBody.data.decision,
      note: parsedBody.data.note || null,
    },
    select: {
      id: true,
      decision: true,
      note: true,
      createdAt: true,
      reviewer: { select: { fullName: true, email: true } },
    },
  });

  return NextResponse.json({
    success: true,
    review: { ...review, createdAt: review.createdAt.toISOString() },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
