import 'server-only';
import { Prisma, PromotionQualificationStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { LoanGoal } from '@prisma/client';

type Rule = { field?: unknown; op?: unknown; value?: unknown };
type RuleGroup = { all?: unknown; any?: unknown };
type PromotionRecord = {
  id: string;
  version: number;
  name: string;
  amount: Prisma.Decimal | null;
  currency: string;
  requiredGoal: LoanGoal | null;
  minimumLoanAmount: Prisma.Decimal | null;
  maximumLoanAmount: Prisma.Decimal | null;
  firstHomeBuyerOnly: boolean;
  applicationWindowStart: Date | null;
  applicationWindowEnd: Date | null;
  settlementWithinDays: number | null;
  drawdownWithinDays: number | null;
  eligibilityRules: Prisma.JsonValue;
  exclusionRules: Prisma.JsonValue;
  terms: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  sourceSnapshot: { sourceFeature: Prisma.JsonValue; sourceHash: string };
};

export type PromotionAssessment = {
  promotionId: string;
  version: number;
  name: string;
  amount: string | null;
  currency: string;
  qualification: PromotionQualificationStatus;
  appliedAmount: string;
  reasons: string[];
  terms: string | null;
  sourceUri: string | null;
  sourceHash: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => record(value)[key], source);
}

function compare(left: unknown, op: string, right: unknown): boolean | null {
  if (left === undefined || left === null) return null;
  const operator = op.toUpperCase();
  if (operator === 'EQ') return left === right;
  if (operator === 'NEQ') return left !== right;
  if (operator === 'IN') return Array.isArray(right) ? right.includes(left) : null;
  const a = Number(left), b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (operator === 'GTE') return a >= b;
  if (operator === 'GT') return a > b;
  if (operator === 'LTE') return a <= b;
  if (operator === 'LT') return a < b;
  return null;
}

function evalGroup(input: unknown, context: Record<string, unknown>): boolean | null {
  const group = record(input) as RuleGroup;
  if (Array.isArray(group.all)) {
    const results = group.all.map(item => evalNode(item, context));
    if (results.includes(false)) return false;
    return results.includes(null) ? null : true;
  }
  if (Array.isArray(group.any)) {
    const results = group.any.map(item => evalNode(item, context));
    if (results.includes(true)) return true;
    return results.includes(null) ? null : false;
  }
  return null;
}

function evalNode(input: unknown, context: Record<string, unknown>): boolean | null {
  const object = record(input);
  if (Array.isArray(object.all) || Array.isArray(object.any)) return evalGroup(object, context);
  const rule = object as Rule;
  if (typeof rule.field !== 'string' || typeof rule.op !== 'string') return null;
  return compare(readPath(context, rule.field), rule.op, rule.value);
}

function hasRuleGroup(input: unknown): boolean {
  const object = record(input);
  return Array.isArray(object.all) || Array.isArray(object.any);
}

function and(results: Array<boolean | null>): boolean | null {
  if (results.includes(false)) return false;
  return results.includes(null) ? null : true;
}

function calendarDate(value: unknown): string | null {
  if (typeof value === 'string') {
    const date = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    return date && Number.isFinite(new Date(`${date}T00:00:00.000Z`).getTime()) ? date : null;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function matchesDateWindow(value: unknown, start: Date | null, end: Date | null): boolean | null {
  if (!start && !end) return true;
  const date = calendarDate(value);
  if (!date) return null;
  const startDate = start ? calendarDate(start) : null;
  const endDate = end ? calendarDate(end) : null;
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

export function assessPromotions(promotions: PromotionRecord[], context: Record<string, unknown>, now = new Date()): PromotionAssessment[] {
  return promotions.map(promotion => {
    const sourceFeature = record(promotion.sourceSnapshot.sourceFeature);
    const application = record(context.application);
    const loan = record(context.loan);
    // For preliminary comparison, this run's calculation date is the assumed
    // lender application date, as requested for the current product flow.
    const applicationDate = now.toISOString();
    const assumesSettlementTiming = promotion.settlementWithinDays !== null
      && (application.daysToSettlement === undefined || application.daysToSettlement === null);
    const assumesDrawdownTiming = promotion.drawdownWithinDays !== null
      && (application.daysToDrawdown === undefined || application.daysToDrawdown === null);
    const facts = [
      promotion.requiredGoal === null ? true : application.goal === undefined || application.goal === null ? null : application.goal === promotion.requiredGoal,
      promotion.minimumLoanAmount === null ? true : compare(loan.amount, 'GTE', promotion.minimumLoanAmount.toNumber()),
      promotion.maximumLoanAmount === null ? true : compare(loan.amount, 'LTE', promotion.maximumLoanAmount.toNumber()),
      !promotion.firstHomeBuyerOnly ? true : application.isFirstHomeBuyer === undefined || application.isFirstHomeBuyer === null ? null : application.isFirstHomeBuyer === true,
      matchesDateWindow(applicationDate, promotion.applicationWindowStart, promotion.applicationWindowEnd),
      promotion.settlementWithinDays === null || assumesSettlementTiming ? true : compare(application.daysToSettlement, 'LTE', promotion.settlementWithinDays),
      promotion.drawdownWithinDays === null || assumesDrawdownTiming ? true : compare(application.daysToDrawdown, 'LTE', promotion.drawdownWithinDays),
    ];
    const customRules = hasRuleGroup(promotion.eligibilityRules) ? evalGroup(promotion.eligibilityRules, context) : true;
    const customExclusions = hasRuleGroup(promotion.exclusionRules) ? evalGroup(promotion.exclusionRules, context) : false;
    const rules = and([...facts, customRules]);
    const exclusions = customExclusions;
    const outsideValidity = Boolean((promotion.validFrom && now < promotion.validFrom) || (promotion.validUntil && now > promotion.validUntil));
    let qualification: PromotionQualificationStatus;
    const reasons: string[] = [];
    if (promotion.applicationWindowStart || promotion.applicationWindowEnd) {
      reasons.push('APPLICATION_DATE_ASSUMED_AS_OF_RECOMMENDATION');
    }
    if (assumesSettlementTiming) reasons.push('SETTLEMENT_TIMING_ASSUMED_WITHIN_OFFER_LIMIT');
    if (assumesDrawdownTiming) reasons.push('DRAWDOWN_TIMING_ASSUMED_WITHIN_OFFER_LIMIT');

    if (outsideValidity) {
      qualification = PromotionQualificationStatus.DOES_NOT_QUALIFY;
      reasons.push('OFFER_OUTSIDE_VALIDITY_WINDOW');
    } else if (exclusions === true || rules === false) {
      qualification = PromotionQualificationStatus.DOES_NOT_QUALIFY;
      reasons.push(exclusions === true ? 'EXCLUSION_RULE_MATCHED' : 'ELIGIBILITY_RULE_NOT_MET');
    } else if (rules === true && exclusions === false) {
      qualification = PromotionQualificationStatus.QUALIFIES;
    } else {
      qualification = PromotionQualificationStatus.NEEDS_REVIEW;
      reasons.push('MISSING_REQUIRED_PROMOTION_FACTS');
    }

    const amount = promotion.amount?.toFixed(2) ?? null;
    return {
      promotionId: promotion.id,
      version: promotion.version,
      name: promotion.name,
      amount,
      currency: promotion.currency,
      qualification,
      appliedAmount: qualification === PromotionQualificationStatus.QUALIFIES ? amount ?? '0.00' : '0.00',
      reasons,
      terms: promotion.terms,
      sourceUri: typeof sourceFeature.additionalInfoUri === 'string' ? sourceFeature.additionalInfoUri : null,
      sourceHash: promotion.sourceSnapshot.sourceHash,
    };
  });
}

export function projectNetCost(
  principal: Decimal,
  annualRate: Decimal,
  repayment: string,
  interestOnlyMonths: number,
  horizonMonths: number,
  cashback: Decimal,
) {
  const monthlyRate = annualRate.div(100).div(12);
  const originalTermMonths = 360;
  let balance = principal;
  let remainingInterestOnly = repayment === 'INTEREST_ONLY' ? Math.min(interestOnlyMonths, originalTermMonths) : 0;
  let amortizingPayment: Decimal | null = null;
  let totalPayments = new Decimal(0);

  for (let month = 1; month <= horizonMonths; month++) {
    let payment: Decimal;
    if (remainingInterestOnly > 0) {
      payment = balance.mul(monthlyRate);
      remainingInterestOnly--;
    } else {
      const remainingTerm = originalTermMonths - Math.min(interestOnlyMonths, originalTermMonths);
      const amortizationMonths = repayment === 'INTEREST_ONLY' ? Math.max(1, remainingTerm) : originalTermMonths;
      if (amortizingPayment === null) {
        const factor = monthlyRate.plus(1).pow(amortizationMonths);
        amortizingPayment = monthlyRate.isZero() ? balance.div(amortizationMonths) : balance.mul(monthlyRate).mul(factor).div(factor.minus(1));
      }
      payment = amortizingPayment;
      const interest = balance.mul(monthlyRate);
      balance = Decimal.max(0, balance.plus(interest).minus(payment));
    }
    totalPayments = totalPayments.plus(payment);
  }

  // Product fee records are displayed for reference but intentionally excluded
  // from the comparison and ranking model.
  const netCost = totalPayments.plus(balance).minus(principal).minus(cashback);
  return {
    netCost,
    effectiveMonthlyCost: netCost.div(horizonMonths),
    projectedBalance: balance,
  };
}
