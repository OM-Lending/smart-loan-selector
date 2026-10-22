import 'server-only';
import { prisma } from '@/server/lib/prisma';
import { Decimal } from 'decimal.js';
import { RatePreference, RepaymentStructure, Prisma, QuoteEligibilityStatus } from '@prisma/client';
import { assessPromotions, projectNetCost } from '@/server/services/promotions/promotion-evaluator';

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

const RULES_VERSION = 'mortgage-v2.0.0';
const ENGINE_VERSION = 'recommendation-engine-v10';
const COMPARISON_HORIZON_MONTHS = 60;
const D = (value: unknown) => new Decimal(value === null || value === undefined ? 0 : String(value));
// Older database rows were persisted directly from CDR RateString (ratio
// form); normalize them while reading until the next full CDR sync rewrites
// the current rows in percentage points.
const asPercentagePoints = (value: unknown) => {
  const rate = D(value);
  return rate.abs().lte(1) ? rate.mul(100) : rate;
};
type Candidate = Prisma.LoanRateGetPayload<{ include: { product: { include: { lender: true; constraints: true; fees: true } } } }>;

function calculateMonthlyRepayment(principal: Decimal, annualRate: Decimal, years: number, repayment: string) {
  const months = years * 12;
  const monthlyRate = annualRate.div(100).div(12);
  if (repayment === 'INTEREST_ONLY') return principal.mul(monthlyRate);
  if (monthlyRate.isZero()) return principal.div(months);
  const factor = monthlyRate.plus(1).pow(months);
  return principal.mul(monthlyRate).mul(factor).div(factor.minus(1));
}

function assess(candidate: Candidate, app: { relationshipStatus: string; dependents: number }, loanAmount: Decimal, lvr: Decimal, requestedIOYears: number, requestedFixedYears: number) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const productRules = candidate.product.constraints ?? [];
  const recommendationRules = jsonObject(candidate.product.recommendationEligibilityRules);
  if (recommendationRules.applicantType === 'SINGLE_PARENT_ONLY'
    && !(['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'SINGLE'].includes(app.relationshipStatus) && app.dependents > 0)) {
    reasons.push('SINGLE_PARENT_ONLY_PRODUCT');
  }
  if (candidate.minAmount && loanAmount.lt(candidate.minAmount)) reasons.push('BELOW_RATE_MINIMUM_AMOUNT');
  if (candidate.maxAmount && loanAmount.gt(candidate.maxAmount)) reasons.push('ABOVE_RATE_MAXIMUM_AMOUNT');
  if (candidate.minLvr && lvr.lt(candidate.minLvr)) reasons.push('BELOW_RATE_MINIMUM_LVR');
  if (candidate.maxLvr && lvr.gt(candidate.maxLvr)) reasons.push('ABOVE_RATE_MAXIMUM_LVR');

  for (const rule of productRules) {
    if (rule.parseStatus !== 'PARSED') {
      warnings.push('PRODUCT_CONSTRAINTS_REQUIRE_REVIEW');
      continue;
    }
    const applicability = rule.applicability && typeof rule.applicability === 'object' && !Array.isArray(rule.applicability)
      ? rule.applicability as Record<string, unknown> : {};
    if (applicability.applicationType) {
      warnings.push('CONSTRAINT_APPLICABILITY_REQUIRES_REVIEW');
      continue;
    }
    const value = rule.numericValue ? new Decimal(rule.numericValue.toString()) : null;
    if (!value) continue;
    if (rule.constraintType === 'MIN_LVR' && lvr.lt(value)) reasons.push('BELOW_PRODUCT_MINIMUM_LVR');
    if (rule.constraintType === 'MAX_LVR' && lvr.gt(value)) reasons.push('ABOVE_PRODUCT_MAXIMUM_LVR');
    if (rule.constraintType === 'MIN_LIMIT' && loanAmount.lt(value)) reasons.push('BELOW_PRODUCT_MINIMUM_AMOUNT');
    if (rule.constraintType === 'MAX_LIMIT' && loanAmount.gt(value)) reasons.push('ABOVE_PRODUCT_MAXIMUM_AMOUNT');
  }
  if (candidate.parseStatus !== 'PARSED') warnings.push('RATE_CONDITIONS_REQUIRE_REVIEW');
  if (candidate.product.parseStatus !== 'PARSED') warnings.push('PRODUCT_DATA_REQUIRES_REVIEW');

  // Features are deliberately three-state. The current questionnaire does not
  // require a feature, so missing feature data is a display note, not a failure.
  let unknownFees = (candidate.product.fees?.length ?? 0) === 0;
  for (const fee of candidate.product.fees ?? []) {
    if (fee.parseStatus !== 'PARSED' || !fee.amount) unknownFees = true;
  }
  if (unknownFees) warnings.push('SOME_FEES_CANNOT_BE_ESTIMATED');
  if (candidate.rateType === 'FIXED' && requestedFixedYears > 0) {
    if (candidate.fixedPeriodMonths === null) warnings.push('FIXED_PERIOD_NOT_CONFIRMED');
    else if (candidate.fixedPeriodMonths !== requestedFixedYears * 12) reasons.push('FIXED_PERIOD_MISMATCH');
  }
  if (candidate.repaymentType === 'INTEREST_ONLY' && requestedIOYears > 0) {
    const relevant = productRules.filter(r => r.constraintType === 'MAX_INTEREST_ONLY_TERM');
    if (relevant.length === 0) warnings.push('INTEREST_ONLY_TERM_NOT_CONFIRMED');
    else if (relevant.every(r => r.parseStatus === 'PARSED' && r.numericValue && new Decimal(r.numericValue.toString()).lt(requestedIOYears))) reasons.push('INTEREST_ONLY_TERM_EXCEEDS_PRODUCT_LIMIT');
  }
  const eligibilityNeedsReview = warnings.some(code => code !== 'SOME_FEES_CANNOT_BE_ESTIMATED');
  const status: QuoteEligibilityStatus = reasons.length ? 'INELIGIBLE' : eligibilityNeedsReview ? 'REVIEW_REQUIRED' : 'ELIGIBLE';
  return { status, reasons, warnings, unknownFees };
}

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function generateRecommendations({ applicationId, userId }: { applicationId: string; userId: string }) {
  const app = await prisma.application.findFirst({ where: { id: applicationId, userId, user: { deletedAt: null } } });
  if (!app) throw new NotFoundError('Application not found or unauthorized');
  const propertyValue = D(app.goal === 'BUY' ? app.purchasePrice : app.propertyValue);
  const loanAmount = app.goal === 'BUY' ? propertyValue.minus(D(app.deposit)) : D(app.currentLoanBalance);
  if (!propertyValue.gt(0) || !loanAmount.gt(0) || loanAmount.gt(propertyValue)) throw new ValidationError('Invalid property or loan value');
  // Internal convention: LVR is percentage points (80.00 means 80%).
  const lvr = loanAmount.div(propertyValue).mul(100);
  const targetPurpose = (app.propertyUse || 'OWNER_OCCUPIED').toUpperCase();
  const targetRepayment = app.repaymentStructure === 'INTEREST_ONLY' ? 'INTEREST_ONLY' : 'P_AND_I';
  const targetRateType = app.ratePreference === 'FIXED' ? 'FIXED' : 'VARIABLE';
  const requestedIOYears = Number.parseInt(app.interestOnlyYears ?? '0', 10) || 0;
  const requestedFixedYears = Number.parseInt(app.fixedYears ?? '0', 10) || 0;

  const rates = await prisma.loanRate.findMany({
    where: {
      isActive: true,
      rateType: targetRateType,
      // Older CDR sync rows used the source enum value. Keep them eligible
      // until the next full sync rewrites them to the canonical P_AND_I.
      repaymentType: {
        in: targetRepayment === 'P_AND_I'
          ? ['P_AND_I', 'PRINCIPAL_AND_INTEREST', 'ALL']
          : [targetRepayment, 'ALL'],
      },
      loanPurpose: { in: [targetPurpose, 'ALL'] },
      lastSyncRunId: { not: null },
      product: { isActive: true, recommendationStatus: 'INCLUDED', lender: { isActive: true } },
    },
    include: { product: { include: {
      lender: true,
      constraints: true,
      fees: true,
      promotionSources: {
        where: { isCurrent: true, reviewStatus: 'REVIEWED', changeType: { not: 'REMOVED' } },
        include: { promotions: { where: { status: 'PUBLISHED', parseStatus: 'PARSED' } } },
      },
    } } },
  });

  const assessed = rates.map(candidate => {
    const eligibility = assess(candidate, app, loanAmount, lvr, requestedIOYears, requestedFixedYears);
    const rate = asPercentagePoints(candidate.interestRate);
    const repayment = calculateMonthlyRepayment(loanAmount, rate, 30, targetRepayment);
    const promotionContext = {
      application: {
        ...jsonObject(app.promotionAnswers),
        goal: app.goal,
        isFirstHomeBuyer: app.isFirstHomeBuyer,
        propertyUse: targetPurpose,
      },
      loan: { amount: loanAmount.toNumber(), lvr: lvr.toNumber() },
    };
    const promotions = assessPromotions(
      candidate.product.promotionSources.flatMap(source => source.promotions.map(promotion => ({
        ...promotion,
        sourceSnapshot: { sourceFeature: source.sourceFeature, sourceHash: source.sourceHash },
      }))),
      promotionContext,
    );
    const appliedCashback = promotions.reduce((sum, promotion) => sum.plus(promotion.appliedAmount), new Decimal(0));
    const projected = projectNetCost(
      loanAmount,
      rate,
      targetRepayment,
      requestedIOYears * 12,
      COMPARISON_HORIZON_MONTHS,
      appliedCashback,
    );
    // Keep the rate-only score as a tie-breaker. Primary ordering uses net
    // projected borrowing cost with only positively matched cashback applied.
    const score = new Decimal(100).minus(rate.mul(10));
    const reasons = [
      `Estimated LVR ${lvr.toFixed(2)}%`, `Rate ${candidate.rateType.toLowerCase()} selected`,
      `${targetRepayment} repayment selected`, `Loan amount ${loanAmount.toFixed(2)} AUD`,
      ...(requestedFixedYears ? [`Requested fixed period: ${requestedFixedYears} years`] : []),
      ...eligibility.reasons, ...eligibility.warnings,
    ];
    return { candidate, eligibility, rate, repayment, score, reasons, promotions, appliedCashback, projected };
  });
  assessed.sort((a, b) => {
    // Parsing warnings remain visible on each quote, but must not push a
    // potentially suitable lower-cost product below every fully parsed rate.
    // Hard ineligibility is still excluded when selecting the final top five.
    return a.projected.netCost.minus(b.projected.netCost).toNumber()
      || b.score.minus(a.score).toNumber();
  });
  const top = assessed.filter(x => x.eligibility.status !== 'INELIGIBLE').slice(0, 5);
  const lenderDataAsOf = top.length ? new Date(Math.max(...top.map(x => x.candidate.lastObservedAt.getTime()))) : new Date();
  const inputSnapshot = {
    applicationVersion: 2, goal: app.goal,
    property: { value: propertyValue.toFixed(2), postcode: app.propertyPostcode, type: app.propertyType, use: targetPurpose },
    loan: { amount: loanAmount.toFixed(2), lvr: lvr.toFixed(2), repayment: targetRepayment, requestedInterestOnlyYears: requestedIOYears, requestedFixedYears },
    preferences: { rateType: targetRateType },
    promotionAnswers: jsonObject(app.promotionAnswers),
  };

  const runId = await prisma.$transaction(async tx => {
    const run = await tx.recommendationRun.create({ data: {
      applicationId: app.id, rulesVersion: RULES_VERSION, engineVersion: ENGINE_VERSION,
      lenderDataAsOf, inputSnapshot: inputSnapshot as Prisma.InputJsonValue, status: 'COMPLETED',
    } });
    if (top.length) await tx.applicationQuote.createMany({ data: top.map((result, index) => ({
      applicationId: app.id, recommendationRunId: run.id, productId: result.candidate.productId, rateId: result.candidate.id,
      lenderName: result.candidate.product.lender.name, productName: result.candidate.product.productName,
      quotedRate: result.rate, quotedRateType: targetRateType as RatePreference,
      quotedRepayment: targetRepayment as RepaymentStructure, annualFee: null, calculatedLvr: lvr,
      monthlyRepayment: result.repayment, score: result.score, rank: index + 1,
      comparisonCost: result.projected.netCost,
      comparisonHorizonMonths: COMPARISON_HORIZON_MONTHS,
      explanation: {
        summary: `${result.candidate.product.lender.name} ${result.candidate.product.productName}`,
        eligibility: {
          status: result.eligibility.status,
          reasons: result.eligibility.reasons,
          warnings: result.eligibility.warnings,
        },
        highlights: result.reasons,
      } as Prisma.InputJsonValue, eligibilityStatus: result.eligibility.status,
      productSnapshot: {
        name: result.candidate.product.productName, features: result.candidate.product.features,
        recommendationEligibilityRules: result.candidate.product.recommendationEligibilityRules,
        constraints: result.candidate.product.constraints.map(c => c.rawConstraint),
      } as Prisma.InputJsonValue,
      rateSnapshot: {
        rate: result.rate.toString(), type: result.candidate.rateType,
        repaymentType: result.candidate.repaymentType, loanPurpose: result.candidate.loanPurpose,
        minAmount: result.candidate.minAmount?.toString() ?? null, maxAmount: result.candidate.maxAmount?.toString() ?? null,
        minLvr: result.candidate.minLvr?.toString() ?? null, maxLvr: result.candidate.maxLvr?.toString() ?? null,
        fixedPeriodMonths: result.candidate.fixedPeriodMonths,
        conditions: result.candidate.rateConditions,
      } as Prisma.InputJsonValue,
      feeSnapshot: result.candidate.product.fees.map(fee => ({ name: fee.name, type: fee.feeType, amount: fee.amount?.toString() ?? null, frequency: fee.frequency, parseStatus: fee.parseStatus, raw: fee.rawFee })) as Prisma.InputJsonValue,
      promotionSnapshot: result.promotions as unknown as Prisma.InputJsonValue,
      sourceSyncRunId: result.candidate.lastSyncRunId!, sourceObservedAt: result.candidate.lastObservedAt,
    })) });
    return run.id;
  });
  return {
    success: true,
    applicationId: app.id,
    recommendationRunId: runId,
    runVersion: RULES_VERSION,
    count: top.length,
    quotes: top.map((result, index) => ({
      id: result.candidate.id,
      rank: index + 1,
      productId: result.candidate.productId,
      rateId: result.candidate.id,
      lenderName: result.candidate.product.lender.name,
      lenderLogoUrl: result.candidate.product.lender.logoUrl,
      productName: result.candidate.product.productName,
      eligibility: {
        status: result.eligibility.status,
        reasons: result.eligibility.reasons,
        warnings: result.eligibility.warnings,
        explanation: result.reasons,
      },
      rate: {
        value: result.rate.toString(),
        type: result.candidate.rateType,
        repaymentType: result.candidate.repaymentType,
        fixedPeriodMonths: result.candidate.fixedPeriodMonths,
        minAmount: result.candidate.minAmount?.toString() ?? null,
        maxAmount: result.candidate.maxAmount?.toString() ?? null,
        minLvr: result.candidate.minLvr?.toString() ?? null,
        maxLvr: result.candidate.maxLvr?.toString() ?? null,
      },
      estimate: {
        loanAmount: loanAmount.toFixed(2),
        lvr: lvr.toFixed(2),
        monthlyRepayment: result.repayment.toFixed(2),
        loanTermYears: 30,
      },
      score: result.score.toNumber(),
      comparison: {
        horizonMonths: COMPARISON_HORIZON_MONTHS,
        netCost: result.projected.netCost.toFixed(2),
        effectiveMonthlyCost: result.projected.effectiveMonthlyCost.toFixed(2),
        projectedBalance: result.projected.projectedBalance.toFixed(2),
        rateAssumption: 'Current quoted rate held constant for the full comparison horizon',
      },
      promotions: result.promotions,
      features: result.candidate.product.features,
      fees: {
        items: result.candidate.product.fees.map(fee => ({
          name: fee.name,
          type: fee.feeType,
          method: fee.feeMethod,
          amount: fee.amount?.toString() ?? null,
          currency: fee.currency,
          frequency: fee.frequency,
          parseStatus: fee.parseStatus,
          additionalInfo: fee.additionalInfo,
          details: fee.rawFee,
        })),
        estimateComplete: !result.eligibility.unknownFees,
      },
      sourceObservedAt: result.candidate.lastObservedAt.toISOString(),
    })),
  };
}
