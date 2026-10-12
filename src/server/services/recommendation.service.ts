import 'server-only';
import { prisma } from '@/server/lib/prisma';
import { Decimal } from 'decimal.js';
import { RatePreference, RepaymentStructure } from '@prisma/client';

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

const RULES_VERSION = 'mortgage-v1.0.0';
const ENGINE_VERSION = 'recommendation-engine-v2';

function normalizeLoanPurpose(propertyUse?: string | null) {
  return (propertyUse || '').toUpperCase() === 'INVESTMENT' ? 'INVESTMENT' : 'OWNER_OCCUPIED';
}
function normalizeRepaymentType(repayment: string) {
  return repayment === 'INTEREST_ONLY' ? 'INTEREST_ONLY' : 'PRINCIPAL_AND_INTEREST';
}
function normalizeRateType(ratePref: string) {
  return ratePref === 'FIXED' ? 'FIXED' : 'VARIABLE';
}

function calculateMonthlyRepayment(principal: Decimal, annualRate: Decimal, years: number, repayment: string) {
  const months = years * 12;
  const monthlyRate = annualRate.div(100).div(12);

  if (repayment === 'INTEREST_ONLY') return principal.mul(monthlyRate);
  if (monthlyRate.isZero()) return principal.div(months);

  const factor = monthlyRate.plus(1).pow(months);
  return principal.mul(monthlyRate).mul(factor).div(factor.minus(1));
}

export async function generateRecommendations({ applicationId, userId }: { applicationId: string, userId: string }) {
  const app = await prisma.application.findFirst({ where: { id: applicationId, userId, user: { deletedAt: null } } });
  if (!app) throw new NotFoundError('Application not found or unauthorized');

  const propertyValue = new Decimal(app.goal === 'BUY' ? app.purchasePrice || 0 : app.propertyValue || 0);
  const loanAmount = app.goal === 'BUY' ? propertyValue.minus(new Decimal(app.deposit || 0)) : new Decimal(app.currentLoanBalance || 0);
  if (propertyValue.isZero() || loanAmount.isZero()) throw new ValidationError('Invalid property or loan value');
  const lvr = loanAmount.div(propertyValue).mul(100);

  const targetPurpose = normalizeLoanPurpose(app.propertyUse);
  const targetRepayment = normalizeRepaymentType(app.repaymentStructure);
  const targetRateType = normalizeRateType(app.ratePreference);

  // DB-Level Eligibility Filtering
  const eligibleRates = await prisma.loanRate.findMany({
    where: {
      isActive: true,
      rateType: targetRateType,
      repaymentType: targetRepayment,
      loanPurpose: targetPurpose,
      product: {
        isActive: true,
        lender: { isActive: true },
        AND: [
          { OR: [{ maxLvr: null }, { maxLvr: { gte: lvr.toNumber() } }] },
          { OR: [{ minLimit: null }, { minLimit: { lte: loanAmount.toNumber() } }] }
        ]
        // maxLvr: { gte: lvr.toNumber() },
        // OR: [ { minLimit: null }, { minLimit: { lte: loanAmount.toNumber() } } ]
      }
    },
    include: { product: { include: { lender: true } } }
  });


  const rankedResults = [];
  for (const candidate of eligibleRates) {
    const rateValue = new Decimal(candidate.interestRate as any);
    const estimatedRepayment = calculateMonthlyRepayment(loanAmount, rateValue, 30, targetRepayment);
    
    // Scoring Engine
    let score = new Decimal(100).minus(rateValue.mul(10));
    if (candidate.product.lender.tier === 1) score = score.plus(5); // Soft preference for Big 4
    
    const explanation = [
      `Within your estimated LVR of ${lvr.toFixed(2)}%`,
      `Matches ${app.ratePreference.toLowerCase()} rate preference`,
      `Matches ${app.repaymentStructure.replace('_', ' ').toLowerCase()} structure`
    ];

    rankedResults.push({ candidate, score, explanation, estimatedRepayment });
  }

  rankedResults.sort((a, b) => b.score.minus(a.score).toNumber());
  const topResults = rankedResults.slice(0, 5);

  const maxObservedAt = topResults.length > 0 
    ? new Date(Math.max(...topResults.map(r => r.candidate.lastObservedAt.getTime())))
    : new Date();

  const inputSnapshot = {
    applicationVersion: 1,
    goal: app.goal,
    property: { value: propertyValue.toFixed(2), postcode: app.propertyPostcode, type: app.propertyType, use: app.propertyUse },
    financial: { loanAmount: loanAmount.toFixed(2), lvr: lvr.toFixed(2), grossAnnualSalary: app.grossAnnualSalary.toString() },
    preferences: { rateType: app.ratePreference, repayment: app.repaymentStructure }
  };

  await prisma.$transaction(async (tx) => {
    const run = await tx.recommendationRun.create({
      data: {
        applicationId: app.id,
        rulesVersion: RULES_VERSION,
        engineVersion: ENGINE_VERSION,
        lenderDataAsOf: maxObservedAt,
        inputSnapshot: inputSnapshot as any, // Pass JSON Object
        status: 'COMPLETED'
      }
    });

    if (topResults.length > 0) {
      await tx.applicationQuote.createMany({
        data: topResults.map((res, index) => ({
          applicationId: app.id,
          recommendationRunId: run.id,
          productId: res.candidate.productId,
          lenderName: res.candidate.product.lender.name,
          productName: res.candidate.product.productName,
          quotedRate: res.candidate.interestRate,
          quotedRateType: app.ratePreference, 
          quotedRepayment: app.repaymentStructure,
          calculatedLvr: lvr,
          monthlyRepayment: res.estimatedRepayment,
          score: res.score,
          explanation: res.explanation as any, // Pass Array
          rank: index + 1,
          sourceSyncRunId: res.candidate.lastSyncRunId!,
          sourceObservedAt: res.candidate.lastObservedAt
        }))
      });
    }
  });

  return {
    success: true,
    count: topResults.length,
    runVersion: RULES_VERSION,
    quotes: topResults.map((r) => ({
      lenderName: r.candidate.product.lender.name,
      productName: r.candidate.product.productName,
      rate: r.candidate.interestRate,
      repayment: r.estimatedRepayment,
      score: r.score,
    })),
  };
}