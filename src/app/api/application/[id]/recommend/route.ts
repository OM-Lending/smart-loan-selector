import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { generateRecommendations, NotFoundError, ValidationError } from '@/server/services/recommendation.service';

const ParamsSchema = z.object({ id: z.string().uuid() });

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!identity.profile) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const { id } = ParamsSchema.parse(await context.params);
    const run = await prisma.recommendationRun.findFirst({
      where: { applicationId: id, application: { userId: identity.profile.id } },
      orderBy: { createdAt: 'desc' },
      include: { quotes: { orderBy: { rank: 'asc' } } },
    });
    if (!run) return NextResponse.json({
      success: true,
      applicationId: id,
      recommendationStatus: 'PENDING',
      count: 0,
      quotes: [],
    });

    const quotes = run.quotes.map(quote => {
      const product = asRecord(quote.productSnapshot);
      const rate = asRecord(quote.rateSnapshot);
      const feeItems = Array.isArray(quote.feeSnapshot) ? quote.feeSnapshot : [];
      return {
        id: quote.id,
        rank: quote.rank,
        productId: quote.productId,
        rateId: quote.rateId,
        lenderName: quote.lenderName,
        productName: quote.productName,
        eligibility: {
          status: quote.eligibilityStatus,
          ...asRecord(asRecord(quote.explanation).eligibility),
          explanation: asRecord(quote.explanation).highlights ?? quote.explanation,
        },
        rate: {
          value: quote.quotedRate.toString(),
          type: quote.quotedRateType,
          repaymentType: quote.quotedRepayment,
          fixedPeriodMonths: rate.fixedPeriodMonths ?? null,
          minAmount: rate.minAmount ?? null,
          maxAmount: rate.maxAmount ?? null,
          minLvr: rate.minLvr ?? null,
          maxLvr: rate.maxLvr ?? null,
        },
        estimate: {
          lvr: quote.calculatedLvr?.toString() ?? null,
          monthlyRepayment: quote.monthlyRepayment?.toString() ?? null,
        },
        comparison: {
          horizonMonths: quote.comparisonHorizonMonths,
          netCost: quote.comparisonCost?.toString() ?? null,
          effectiveMonthlyCost: quote.comparisonHorizonMonths && quote.comparisonCost
            ? (Number(quote.comparisonCost.toString()) / quote.comparisonHorizonMonths).toFixed(2)
            : null,
          rateAssumption: 'Current quoted rate held constant for the full comparison horizon',
        },
        promotions: Array.isArray(quote.promotionSnapshot) ? quote.promotionSnapshot : [],
        score: quote.score?.toString() ?? null,
        features: product.features ?? [],
        constraints: product.constraints ?? [],
        fees: {
          items: feeItems,
          estimateComplete: feeItems.length > 0 && feeItems.every(item => asRecord(item).parseStatus === 'PARSED'),
        },
        sourceObservedAt: quote.sourceObservedAt.toISOString(),
      };
    });
    return NextResponse.json({
      success: true,
      applicationId: id,
      recommendationRunId: run.id,
      runVersion: run.rulesVersion,
      recommendationStatus: run.status,
      count: quotes.length,
      quotes,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    console.error('Failed to load recommendation results:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!identity.profile) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const rawParams = await context.params;

    const { id } = ParamsSchema.parse(rawParams);
    console.log(`[API] Triggering recommendation for Application ID: ${id}`);

    const result = await generateRecommendations({ applicationId: id, userId: identity.profile.id });
    console.log(`[API] Recommendation Success. Returned ${result.count} quotes.`);
    
    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Recommendation Engine Error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError || error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input parameters' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
