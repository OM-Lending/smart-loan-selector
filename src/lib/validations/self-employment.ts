import { z } from 'zod';

export const BUSINESS_PROFIT_LABEL = 'Annual business net profit before tax (AUD)';
export const BUSINESS_PROFIT_HELP = 'Income minus business expenses, before income tax. Enter the whole business profit, not turnover or your personal salary. Enter 0 or a negative amount if the business made no profit or a loss.';
export const SELF_EMPLOYMENT_FIELDS = ['abn', 'commencedOn', 'annualNetProfitBeforeTax', 'financialYearEnd'] as const;

export function isValidAbn(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  return weights.reduce((sum, weight, index) => sum + (Number(value[index]) - (index === 0 ? 1 : 0)) * weight, 0) % 89 === 0;
}
export function australianBusinessDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

export function latestCompletedFinancialYear(now = new Date()): number {
  // Use the Australian business date, independently of a UTC CI/server timezone.
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year')!.value);
  const month = Number(parts.find(part => part.type === 'month')!.value);
  return month >= 7 ? year : year - 1;
}
const blank = (value: unknown) => value === '' || value === null ? undefined : value;
const profit = z.preprocess(value => {
  if (value === '' || value === null || value === undefined) return undefined;
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^-?(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(value))) return NaN;
  return Number(value);
}, z.number({ error: 'Enter a profit or loss with up to two decimal places.' }).finite().optional());

export const SelfEmploymentSchema = z.object({
  abn: z.preprocess(value => typeof value === 'string' ? value.replace(/\s/g, '') || undefined : blank(value), z.string().refine(isValidAbn, 'Enter a valid 11-digit ABN.').optional()),
  commencedOn: z.preprocess(blank, z.iso.date().refine(value => value <= australianBusinessDateKey(), 'Business commencement date cannot be in the future.').optional()),
  annualNetProfitBeforeTax: profit,
  financialYearEnd: z.preprocess(value => value === '' || value === null || value === undefined ? undefined : Number(value), z.number().int().min(1901).refine(value => value <= latestCompletedFinancialYear(), 'Choose a completed financial year.').optional()),
}).superRefine((value, context) => {
  if (value.annualNetProfitBeforeTax !== undefined && value.financialYearEnd === undefined) context.addIssue({ code: 'custom', path: ['financialYearEnd'], message: 'Select the financial year for this profit or loss.' });
  if (value.financialYearEnd !== undefined && value.annualNetProfitBeforeTax === undefined) context.addIssue({ code: 'custom', path: ['annualNetProfitBeforeTax'], message: 'Enter the profit or loss for this financial year, or leave both fields blank.' });
  if (value.commencedOn && value.financialYearEnd && value.commencedOn > `${value.financialYearEnd}-06-30`) context.addIssue({ code: 'custom', path: ['financialYearEnd'], message: 'Choose a financial year that ends on or after the business started.' });
});
export type SelfEmploymentInput = z.input<typeof SelfEmploymentSchema>;
export type SelfEmploymentData = z.output<typeof SelfEmploymentSchema>;
export const SelfEmploymentDraftSchema = z.object({
  abn: z.string().optional(), commencedOn: z.string().optional(),
  annualNetProfitBeforeTax: z.union([z.string(), z.number()]).optional(),
  financialYearEnd: z.union([z.string(), z.number()]).optional(),
});
