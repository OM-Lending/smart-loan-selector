import 'server-only';
import { Prisma } from '@prisma/client';
import type { SelfEmploymentData } from '@/lib/validations/self-employment';

export function businessProfileData(value: SelfEmploymentData | undefined) {
  return {
    abn: value?.abn ?? null,
    commencedOn: value?.commencedOn ? new Date(`${value.commencedOn}T00:00:00.000Z`) : null,
    annualNetProfitBeforeTax: value?.annualNetProfitBeforeTax === undefined ? null : new Prisma.Decimal(String(value.annualNetProfitBeforeTax)),
    financialYearEnd: value?.financialYearEnd ?? null,
  };
}
export function businessProfileForResponse(value: ReturnType<typeof businessProfileData> | undefined) {
  return value ? { abn: value.abn ?? '', commencedOn: value.commencedOn?.toISOString().slice(0, 10) ?? '', annualNetProfitBeforeTax: value.annualNetProfitBeforeTax?.toString() ?? '', financialYearEnd: value.financialYearEnd ?? '' } : {};
}
