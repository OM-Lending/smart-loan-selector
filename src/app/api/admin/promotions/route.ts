import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const [reviewQueue, publishedPromotions] = await Promise.all([
    prisma.promotionSourceSnapshot.findMany({
      where: { isCurrent: true, reviewStatus: 'REVIEW_REQUIRED' },
      orderBy: [{ changeType: 'desc' }, { lastObservedAt: 'desc' }],
      take: 200,
      include: {
        product: { select: { productName: true, externalId: true, lender: { select: { name: true } } } },
        promotions: { orderBy: { version: 'desc' }, take: 1 },
      },
    }),
    prisma.promotion.findMany({
      where: {
        status: 'PUBLISHED',
        sourceSnapshot: { isCurrent: true, reviewStatus: 'REVIEWED', product: { isActive: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
      include: {
        sourceSnapshot: {
          select: {
            id: true, sourceFeature: true, sourceKey: true, lastObservedAt: true,
            product: { select: { productName: true, externalId: true, lender: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);
  const reviewQueueWithPrevious = await Promise.all(reviewQueue.map(async row => ({
    ...row,
    previousSource: row.changeType === 'DISCOVERED' ? null : await prisma.promotionSourceSnapshot.findFirst({
      where: { productId: row.productId, sourceKey: row.sourceKey, isCurrent: false },
      orderBy: { lastObservedAt: 'desc' },
      select: { sourceFeature: true, lastObservedAt: true },
    }),
  })));

  return NextResponse.json({
    success: true,
    reviewQueue: reviewQueueWithPrevious,
    publishedPromotions: publishedPromotions.map(({ sourceSnapshot, ...promotion }) => ({
      ...promotion,
      sourceSnapshot,
      product: sourceSnapshot.product,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
