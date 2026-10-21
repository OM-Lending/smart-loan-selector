import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const applications = await prisma.application.findMany({
    where: {
      currentStage: 'BROKER_REVIEW',
      user: { deletedAt: null },
      continuation: { is: { status: 'SUBMITTED' } },
    },
    orderBy: { continuation: { submittedAt: 'asc' } },
    take: 100,
    select: {
      id: true,
      goal: true,
      propertyPostcode: true,
      currentStage: true,
      createdAt: true,
      user: { select: { fullName: true, email: true, phone: true } },
      continuation: {
        select: {
          reviewStatus: true,
          submittedAt: true,
          selectedQuote: { select: { lenderName: true, productName: true } },
          _count: { select: { documents: true } },
        },
      },
    },
  });

  return NextResponse.json({
    applications: applications.map(application => ({
      id: application.id,
      goal: application.goal,
      propertyPostcode: application.propertyPostcode,
      currentStage: application.currentStage,
      createdAt: application.createdAt.toISOString(),
      customer: application.user,
      reviewStatus: application.continuation?.reviewStatus ?? 'NEW',
      submittedAt: application.continuation?.submittedAt?.toISOString() ?? null,
      selectedProduct: application.continuation?.selectedQuote ?? null,
      documentCount: application.continuation?._count.documents ?? 0,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
