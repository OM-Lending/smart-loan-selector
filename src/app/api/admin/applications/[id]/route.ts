import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { requireAdmin } from '@/server/lib/admin-auth';

const IdSchema = z.string().uuid();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const parsedId = IdSchema.safeParse((await context.params).id);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });

  const application = await prisma.application.findFirst({
    where: { id: parsedId.data, user: { deletedAt: null } },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
      recommendationRuns: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: {
          quotes: {
            orderBy: { rank: 'asc' },
            include: {
              product: { select: { lender: { select: { logoUrl: true } } } },
              adminReviews: {
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: { reviewer: { select: { fullName: true, email: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  const run = application.recommendationRuns[0] ?? null;

  return NextResponse.json({
    success: true,
    application: {
      id: application.id,
      goal: application.goal,
      buySituation: application.buySituation,
      isFirstHomeBuyer: application.isFirstHomeBuyer,
      propertyUse: application.propertyUse,
      propertyStatus: application.propertyStatus,
      propertyType: application.propertyType,
      propertyPostcode: application.propertyPostcode,
      propertySuburb: application.propertySuburb,
      propertyState: application.propertyState,
      purchasePrice: application.purchasePrice?.toString() ?? null,
      deposit: application.deposit?.toString() ?? null,
      refinanceGoal: application.refinanceGoal,
      cashOutPurpose: application.cashOutPurpose,
      propertyAddress: application.propertyAddress,
      currentLender: application.currentLender,
      propertyValue: application.propertyValue?.toString() ?? null,
      currentLoanBalance: application.currentLoanBalance?.toString() ?? null,
      currentInterestRate: application.currentInterestRate?.toString() ?? null,
      currentRepaymentType: application.currentRepaymentType,
      isFixedRate: application.isFixedRate,
      fixedRateExpiry: application.fixedRateExpiry,
      repaymentStructure: application.repaymentStructure,
      interestOnlyYears: application.interestOnlyYears,
      ratePreference: application.ratePreference,
      fixedYears: application.fixedYears,
      employmentStatus: application.employmentStatus,
      employmentStartDate: application.employmentStartDate,
      grossAnnualSalary: application.grossAnnualSalary.toString(),
      relationshipStatus: application.relationshipStatus,
      partnerEmploymentStatus: application.partnerEmploymentStatus,
      partnerEmploymentStartDate: application.partnerEmploymentStartDate,
      partnerGrossSalary: application.partnerGrossSalary?.toString() ?? null,
      dependents: application.dependents,
      hasExistingLoans: application.hasExistingLoans,
      existingMonthlyRepayment: application.existingMonthlyRepayment?.toString() ?? null,
      hasCreditCard: application.hasCreditCard,
      creditCardLimit: application.creditCardLimit?.toString() ?? null,
      currentStage: application.currentStage,
      createdAt: application.createdAt.toISOString(),
      user: {
        ...application.user,
        createdAt: application.user.createdAt.toISOString(),
      },
      recommendation: run ? {
        id: run.id,
        status: run.status,
        rulesVersion: run.rulesVersion,
        createdAt: run.createdAt.toISOString(),
        quotes: run.quotes.map(quote => ({
          id: quote.id,
          rank: quote.rank,
          lenderName: quote.lenderName,
          lenderLogoUrl: quote.product.lender.logoUrl,
          productName: quote.productName,
          quotedRate: quote.quotedRate.toString(),
          quotedRateType: quote.quotedRateType,
          quotedRepayment: quote.quotedRepayment,
          annualFee: quote.annualFee?.toString() ?? null,
          calculatedLvr: quote.calculatedLvr?.toString() ?? null,
          monthlyRepayment: quote.monthlyRepayment?.toString() ?? null,
          score: quote.score?.toString() ?? null,
          eligibilityStatus: quote.eligibilityStatus,
          comparisonCost: quote.comparisonCost?.toString() ?? null,
          comparisonHorizonMonths: quote.comparisonHorizonMonths,
          explanation: quote.explanation,
          productSnapshot: quote.productSnapshot,
          rateSnapshot: quote.rateSnapshot,
          promotionSnapshot: quote.promotionSnapshot,
          createdAt: quote.createdAt.toISOString(),
          reviews: quote.adminReviews.map(review => ({
            id: review.id,
            decision: review.decision,
            note: review.note,
            createdAt: review.createdAt.toISOString(),
            reviewer: review.reviewer,
          })),
        })),
      } : null,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
