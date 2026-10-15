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
      createdAt: true,
      recommendationRuns: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, _count: { select: { quotes: true } } },
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
      createdAt: application.createdAt.toISOString(),
      recommendationStatus: application.recommendationRuns[0]?.status ?? 'PENDING',
      recommendationCreatedAt: application.recommendationRuns[0]?.createdAt.toISOString() ?? null,
      recommendationCount: application.recommendationRuns[0]?._count.quotes ?? 0,
    })),
  });
}
