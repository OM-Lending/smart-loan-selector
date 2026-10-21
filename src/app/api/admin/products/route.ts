import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

function jsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const status = url.searchParams.get('status') ?? 'ALL';
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = 25;
  const where: Prisma.LoanProductWhereInput = {
    isActive: true,
    lender: { isActive: true },
    ...(status === 'INCLUDED' || status === 'EXCLUDED' ? { recommendationStatus: status as 'INCLUDED' | 'EXCLUDED' } : {}),
    ...(query ? { OR: [
      { productName: { contains: query, mode: 'insensitive' as const } },
      { externalId: { contains: query, mode: 'insensitive' as const } },
      { lender: { name: { contains: query, mode: 'insensitive' as const } } },
    ] } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.loanProduct.findMany({
      where,
      orderBy: [{ lender: { name: 'asc' } }, { productName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, externalId: true, productName: true, description: true,
        recommendationStatus: true, recommendationNote: true, recommendationSourceUri: true, recommendationReviewedAt: true,
        recommendationReviewedBy: { select: { fullName: true, email: true } },
        rawPayload: true, lender: { select: { name: true, logoUrl: true } },
        rates: { where: { isActive: true }, orderBy: { interestRate: 'asc' }, take: 3, select: { rateType: true, interestRate: true } },
      },
    }),
    prisma.loanProduct.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    page,
    pageSize,
    total,
    products: products.map(product => {
      const raw = jsonObject(product.rawPayload);
      const additionalInformation = jsonObject(raw.additionalInformation);
      return {
        id: product.id,
        externalId: product.externalId,
        productName: product.productName,
        description: product.description,
        recommendationStatus: product.recommendationStatus,
        recommendationNote: product.recommendationNote,
        recommendationSourceUri: product.recommendationSourceUri,
        recommendationReviewedAt: product.recommendationReviewedAt?.toISOString() ?? null,
        recommendationReviewer: product.recommendationReviewedBy,
        applicationUri: typeof raw.applicationUri === 'string' ? raw.applicationUri : null,
        overviewUri: typeof additionalInformation.overviewUri === 'string' ? additionalInformation.overviewUri : null,
        lender: product.lender,
        rates: product.rates.map(rate => ({ rateType: rate.rateType, interestRate: rate.interestRate.toString() })),
      };
    }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
