import 'server-only';
import * as crypto from 'crypto';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';

export type CdrObject = Record<string, unknown>;
export const asCdrObject = (value: unknown): CdrObject => value && typeof value === 'object' && !Array.isArray(value) ? value as CdrObject : {};
export const asCdrArray = (value: unknown): CdrObject[] => Array.isArray(value) ? value.map(asCdrObject) : [];
export const toJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map(key => [key, canonical(object[key])]));
  }
  return value;
}
export const contentHash = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

function decimalString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const decimal = new Decimal(String(value));
    return decimal.isFinite() ? decimal.toFixed(2) : null;
  } catch { return null; }
}
function normalizeRateType(value: unknown): string {
  const type = String(value ?? '').toUpperCase();
  if (['FIXED', 'BUNDLE_DISCOUNT_FIXED'].includes(type)) return 'FIXED';
  if (['VARIABLE', 'FLOATING', 'BUNDLE_DISCOUNT_VARIABLE', 'DISCOUNT', 'INTRODUCTORY'].includes(type)) return 'VARIABLE';
  return type || 'UNKNOWN';
}
function normalizeRepayment(value: unknown): string {
  const type = String(value ?? '').toUpperCase();
  return type === 'PRINCIPAL_AND_INTEREST' || type === 'P_AND_I' ? 'P_AND_I' : type || 'ALL';
}
function normalizePurpose(value: unknown): string {
  const type = String(value ?? '').toUpperCase();
  return type === 'OWNER_OCCUPIED' || type === 'INVESTMENT' ? type : type || 'ALL';
}
function fixedPeriodMonths(value: unknown): number | null {
  const text = String(value ?? '').trim().toUpperCase();
  const years = text.match(/^P?(\d+(?:\.\d+)?)Y$/)?.[1] ?? text.match(/(\d+(?:\.\d+)?)\s*(?:YEAR|YEARS|YR|Y)\b/)?.[1];
  if (years) return Math.round(Number(years) * 12);
  const months = text.match(/^P?(\d+)M$/)?.[1] ?? text.match(/(\d+)\s*(?:MONTH|MONTHS|MO)\b/)?.[1];
  return months ? Number(months) : null;
}
function rangeFromTiers(tiers: CdrObject[]) {
  let minAmount: string | null = null, maxAmount: string | null = null;
  let minLvr: string | null = null, maxLvr: string | null = null;
  for (const tier of tiers) {
    const label = `${String(tier.name ?? '')} ${String(tier.unitOfMeasure ?? '')}`.toUpperCase();
    const min = decimalString(tier.minimumValue), max = decimalString(tier.maximumValue);
    if (label.includes('LVR')) {
      minLvr ??= min === null ? null : new Decimal(min).lte(1) ? new Decimal(min).mul(100).toFixed(2) : min;
      maxLvr ??= max === null ? null : new Decimal(max).lte(1) ? new Decimal(max).mul(100).toFixed(2) : max;
    } else if (label.includes('AMOUNT') || label.includes('BALANCE') || label.includes('LOAN')) {
      minAmount ??= min;
      maxAmount ??= max;
    }
  }
  return { minAmount, maxAmount, minLvr, maxLvr };
}
function normalizeConstraint(constraint: CdrObject) {
  const constraintType = String(constraint.constraintType ?? 'OTHER').toUpperCase();
  const value = decimalString(constraint.additionalValue);
  const supported = ['MIN_LVR', 'MAX_LVR', 'MIN_LIMIT', 'MAX_LIMIT'].includes(constraintType) && value !== null;
  const isLvr = constraintType.endsWith('_LVR');
  const numericValue = supported && isLvr && new Decimal(value!).lte(1) ? new Decimal(value!).mul(100).toFixed(2) : value;
  return {
    constraintType, numericValue,
    unit: isLvr ? 'PERCENT' : constraintType.endsWith('_LIMIT') ? 'AUD' : null,
    applicability: toJson({ applicationType: constraint.applicationType ?? null }),
    parseStatus: supported ? 'PARSED' as const : 'UNPARSED' as const,
    description: typeof constraint.additionalInfo === 'string' ? constraint.additionalInfo : null,
    rawConstraint: toJson(constraint),
  };
}
function normalizeFee(fee: CdrObject, index: number) {
  const method = String(fee.feeMethodUType ?? 'unknown');
  const fixedAmount = asCdrObject(fee.fixedAmount);
  const amount = method === 'fixedAmount' ? decimalString(fixedAmount.amount) : null;
  return {
    externalKey: contentHash({ index, name: fee.name, type: fee.feeType, method }),
    name: String(fee.name ?? 'Unnamed fee'), feeType: String(fee.feeType ?? 'OTHER'), feeMethod: method,
    amount, currency: typeof fixedAmount.currency === 'string' ? fixedAmount.currency : 'AUD',
    frequency: typeof fee.additionalValue === 'string' ? fee.additionalValue : null,
    // Preserve discounts as raw CDR data, but do not call a discounted fee
    // fully parsed until discount eligibility can be evaluated.
    parseStatus: method === 'fixedAmount' && amount !== null
      ? (Array.isArray(fee.discounts) && fee.discounts.length > 0 ? 'PARTIALLY_PARSED' as const : 'PARSED' as const)
      : 'UNPARSED' as const,
    additionalInfo: typeof fee.additionalInfo === 'string' ? fee.additionalInfo : null, rawFee: toJson(fee),
  };
}
function normalizeRate(rate: CdrObject) {
  // CDR RateString stores percentages as ratios (1 means 100%). The app's
  // internal convention is percentage points (6.94 means 6.94%).
  const cdrRate = new Decimal(String(rate.rate));
  const numericRate = cdrRate.abs().lte(1) ? cdrRate.mul(100) : cdrRate;
  if (!numericRate.isFinite() || !numericRate.gt(0) || !numericRate.lt(100)) throw new Error('Rate is outside the supported interest range');
  const lendingRateType = normalizeRateType(rate.lendingRateType);
  const tiers = asCdrArray(rate.tiers);
  const normalized = {
    rateType: lendingRateType,
    repaymentType: normalizeRepayment(rate.repaymentType),
    loanPurpose: normalizePurpose(rate.loanPurpose),
    interestRate: numericRate.toFixed(4),
    ...rangeFromTiers(tiers),
    fixedPeriodMonths: lendingRateType === 'FIXED' ? fixedPeriodMonths(rate.additionalValue) : null,
    rateConditions: toJson({ tiers, applicabilityConditions: rate.applicabilityConditions ?? null, additionalValue: rate.additionalValue ?? null }),
    rawRate: toJson(rate),
    parseStatus: rate.applicabilityConditions || tiers.length ? 'PARTIALLY_PARSED' as const : 'PARSED' as const,
  };
  const conditionHash = contentHash({
    rateType: normalized.rateType, repaymentType: normalized.repaymentType, loanPurpose: normalized.loanPurpose,
    minAmount: normalized.minAmount, maxAmount: normalized.maxAmount, minLvr: normalized.minLvr,
    maxLvr: normalized.maxLvr, fixedPeriodMonths: normalized.fixedPeriodMonths, rateConditions: normalized.rateConditions,
  });
  return { ...normalized, conditionHash };
}

export function normalizeCdrProduct(input: unknown) {
  const raw = asCdrObject(input);
  const constraints = asCdrArray(raw.constraints).map(normalizeConstraint);
  const fees = asCdrArray(raw.fees).map(normalizeFee);
  const invalidRates: string[] = [];
  const rates = asCdrArray(raw.lendingRates).flatMap((rate, index) => {
    if (rate.rate === undefined || rate.rate === null || rate.rate === '') return [];
    try { return [normalizeRate(rate)]; }
    catch (error) { invalidRates.push(`lendingRates[${index}]: ${error instanceof Error ? error.message : String(error)}`); return []; }
  });
  const features = Array.isArray(raw.features) ? raw.features : [];
  const productMaxLvr = constraints.find(item => item.constraintType === 'MAX_LVR' && item.parseStatus === 'PARSED')?.numericValue ?? null;
  const productMinLimit = constraints.find(item => item.constraintType === 'MIN_LIMIT' && item.parseStatus === 'PARSED')?.numericValue ?? null;
  return {
    externalId: typeof raw.productId === 'string' ? raw.productId : '',
    productName: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : null,
    features: toJson(features), rawPayload: toJson(raw),
    parseStatus: constraints.some(item => item.parseStatus === 'UNPARSED') ? 'PARTIALLY_PARSED' as const : 'PARSED' as const,
    maxLvr: productMaxLvr, minLimit: productMinLimit,
    constraints, fees, rates, invalidRates,
  };
}
