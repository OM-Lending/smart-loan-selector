import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return access.response;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const applications = await prisma.application.findMany({
    where: { recommendationPresentedAt: { lte: cutoff }, applyClickedAt: null, user: { deletedAt: null } },
    orderBy: { recommendationPresentedAt: 'asc' },
    take: 200,
    select: {
      id: true, goal: true, propertyPostcode: true, recommendationPresentedAt: true, createdAt: true,
      user: { select: { fullName: true, email: true, phone: true } },
      recommendationRuns: { take: 1, orderBy: { createdAt: 'desc' }, select: { _count: { select: { quotes: true } } } },
    },
  });
  return NextResponse.json({
    success: true,
    applications: applications.map(application => ({
      id: application.id, goal: application.goal, propertyPostcode: application.propertyPostcode,
      recommendationPresentedAt: application.recommendationPresentedAt?.toISOString() ?? null,
      createdAt: application.createdAt.toISOString(), user: application.user,
      matchCount: application.recommendationRuns[0]?._count.quotes ?? 0,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
