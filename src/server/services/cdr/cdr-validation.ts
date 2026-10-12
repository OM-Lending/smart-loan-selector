import 'server-only';
import { Decimal } from 'decimal.js';

type NormalizedProduct = ReturnType<typeof import('./cdr-normalizer').normalizeCdrProduct>;

export interface CdrValidationResult {
  errors: string[];
  warnings: string[];
  ratesSafeToReconcile: boolean;
}

export function validateNormalizedProduct(product: NormalizedProduct): CdrValidationResult {
  const errors: string[] = [];
  const warnings = [...product.invalidRates];
  if (!product.externalId) errors.push('Missing CDR productId');
  if (!product.productName) errors.push('Missing product name');
  if (product.rates.length === 0) warnings.push('No usable numeric lending rates were returned');

  let ratesSafeToReconcile = product.invalidRates.length === 0 && product.rates.length > 0;
  const conditionHashes = new Set<string>();
  for (const [index, rate] of product.rates.entries()) {
    if (conditionHashes.has(rate.conditionHash)) {
      ratesSafeToReconcile = false;
      warnings.push(`lendingRates[${index}] duplicates another normalized rate condition`);
    }
    conditionHashes.add(rate.conditionHash);
    if (!['FIXED', 'VARIABLE'].includes(rate.rateType)) warnings.push(`lendingRates[${index}] has unknown lendingRateType: ${rate.rateType}`);
    if (!['P_AND_I', 'INTEREST_ONLY', 'ALL'].includes(rate.repaymentType)) warnings.push(`lendingRates[${index}] has unknown repaymentType: ${rate.repaymentType}`);
    if (!['OWNER_OCCUPIED', 'INVESTMENT', 'ALL'].includes(rate.loanPurpose)) warnings.push(`lendingRates[${index}] has unknown loanPurpose: ${rate.loanPurpose}`);
    if (rate.parseStatus !== 'PARSED') warnings.push(`lendingRates[${index}] has conditions that remain only partially parsed`);
    const minAmount = rate.minAmount === null ? null : new Decimal(rate.minAmount);
    const maxAmount = rate.maxAmount === null ? null : new Decimal(rate.maxAmount);
    const minLvr = rate.minLvr === null ? null : new Decimal(rate.minLvr);
    const maxLvr = rate.maxLvr === null ? null : new Decimal(rate.maxLvr);
    const invalid = (minAmount && minAmount.lt(0))
      || (maxAmount && maxAmount.lte(0))
      || (minAmount && maxAmount && minAmount.gt(maxAmount))
      || (minLvr && (minLvr.lt(0) || minLvr.gt(100)))
      || (maxLvr && (maxLvr.lt(0) || maxLvr.gt(100)))
      || (minLvr && maxLvr && minLvr.gt(maxLvr));
    if (invalid) {
      ratesSafeToReconcile = false;
      warnings.push(`lendingRates[${index}] has an invalid amount or LVR range`);
    }
  }
  return { errors, warnings, ratesSafeToReconcile };
}
