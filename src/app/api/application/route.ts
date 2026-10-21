import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { prisma } from '@/server/lib/prisma';

export async function GET() {
  const identity = await getAuthenticatedProfile();
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!identity.profile) return NextResponse.json({ success: true, applications: [] });

  const applications = await prisma.application.findMany({
    where: { userId: identity.profile.id, user: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      goal: true,
      purchasePrice: true,
      deposit: true,
      propertyValue: true,
      currentLoanBalance: true,
      propertyPostcode: true,
      currentStage: true,
      createdAt: true,
      recommendationRuns: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, _count: { select: { quotes: true } } },
      },
      continuation: {
        select: {
          status: true,
          reviewStatus: true,
          brokerNote: true,
          selectedQuote: { select: { id: true, lenderName: true, productName: true } },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    applications: applications.map(application => ({
      id: application.id,
      goal: application.goal,
      purchasePrice: application.purchasePrice?.toString() ?? null,
      deposit: application.deposit?.toString() ?? null,
      propertyValue: application.propertyValue?.toString() ?? null,
      currentLoanBalance: application.currentLoanBalance?.toString() ?? null,
      propertyPostcode: application.propertyPostcode,
      currentStage: application.currentStage,
      createdAt: application.createdAt.toISOString(),
      recommendationStatus: application.recommendationRuns[0]?.status ?? 'PENDING',
      recommendationCreatedAt: application.recommendationRuns[0]?.createdAt.toISOString() ?? null,
      recommendationCount: application.recommendationRuns[0]?._count.quotes ?? 0,
      continuation: application.continuation ? {
        status: application.continuation.status,
        reviewStatus: application.continuation.reviewStatus,
        brokerNote: application.continuation.brokerNote,
        selectedQuote: application.continuation.selectedQuote,
      } : null,
    })),
  });
}
