import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const followUpCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [userCount, applicationCount, cashbackReviewCount, followUpCount] = await Promise.all([
    prisma.profile.count({ where: { deletedAt: null } }),
    prisma.application.count({ where: { user: { deletedAt: null } } }),
    prisma.promotionSourceSnapshot.count({ where: { reviewStatus: 'REVIEW_REQUIRED', isCurrent: true } }),
    prisma.application.count({ where: { recommendationPresentedAt: { lte: followUpCutoff }, applyClickedAt: null, user: { deletedAt: null } } }),
  ]);

  return NextResponse.json({
    success: true,
    metrics: { userCount, applicationCount, cashbackReviewCount, followUpCount },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
