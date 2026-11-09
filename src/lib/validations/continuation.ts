import { SelfEmploymentSchema } from '@/lib/validations/self-employment';
import { z } from 'zod';
import { EMPLOYMENT_OPTIONS, RESIDENCY_OPTIONS } from '@/lib/continuation-form';
import { RELATIONSHIP_STATUSES } from '@/lib/relationship-status';

const optional = <T extends z.ZodType>(schema: T) => z.union([z.literal(''), z.null(), schema]).optional();
const phone = optional(z.string().refine(value => /^\+?[0-9() -]{8,24}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 8 && (value.match(/\d/g)?.length ?? 0) <= 15, 'Enter a valid phone number.'));
const date = optional(z.iso.date().refine(value => new Date(`${value}T00:00:00`) <= new Date(), 'Choose a date that is not in the future.'));
const money = optional(z.union([z.string().regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/, 'Enter a non-negative amount with up to two decimal places.'), z.number().nonnegative().finite()]).refine(value => Number.isFinite(Number(value)) && Number(value) <= Number.MAX_SAFE_INTEGER, 'Enter a valid amount.'));
const income = optional(z.union([z.string().regex(/^[1-9]\d*$/, 'Enter a positive whole number without leading zeros.'), z.number().int().positive()]).refine(value => Number.isSafeInteger(Number(value)), 'Enter a valid annual income.'));
const employment = optional(z.enum(EMPLOYMENT_OPTIONS.map(option => option.value)));
const maritalStatus = optional(z.enum(RELATIONSHIP_STATUSES));
const applicant = z.object({
  fullName: optional(z.string().max(200)),
  email: optional(z.email().max(254)), mobile: phone,
  visaStatus: optional(z.enum(RESIDENCY_OPTIONS.map(option => option.value))),
  maritalStatus,
  residentialAddress: optional(z.string().max(1000)),
  housingArrangement: optional(z.string().max(500)),
  residentialSince: date,
  dependents: optional(z.union([z.string().regex(/^[0-5]$/), z.number().int().min(0).max(5)])),
  previousAddresses: z.array(z.object({ address: optional(z.string().max(1000)), moveInDate: date, moveOutDate: date }).passthrough().refine(row => !row.moveInDate || !row.moveOutDate || row.moveInDate <= row.moveOutDate, 'Move-out date must be on or after move-in date.')).max(50).optional(),
}).passthrough();
const property = z.object({
  use: optional(z.enum(['OWNER_OCCUPIED', 'INVESTMENT'])),
  address: optional(z.string().max(1000)),
  propertyType: optional(z.string().max(500)),
  bedrooms: optional(z.union([z.string().regex(/^(0|[1-9]\d*)$/, 'Enter a whole number of bedrooms.'), z.number().int().nonnegative()]).refine(value => Number(value) <= 32767, 'Enter no more than 32767 bedrooms.')),
  ownership: optional(z.string().max(500)),
  marketValue: money, loanLimit: money, loanBalance: money, rentalPerWeek: money,
  lender: optional(z.string().max(120)), loanStartDate: date,
  leasedThrough: optional(z.enum(['REAL_ESTATE_AGENT', 'PRIVATE'])),
}).passthrough();

// Omitting any answer or supporting document must never block submission.
// Values the customer does provide still have to be well formed.
export const continuationDetailsSchema = z.object({
  applicant: applicant.optional(),
  applicant2: applicant.extend({ employmentStatus: employment, annualIncome: income, business: SelfEmploymentSchema.optional() }).optional(),
  currentEmployment: z.object({ annualIncome: income, employmentType: employment, business: SelfEmploymentSchema.optional(), startDate: date, officePhone: phone, position: optional(z.string().max(500)), officeAddress: optional(z.string().max(1000)) }).passthrough().optional(),
  previousEmployment: z.object({ officePhone: phone, history: optional(z.string().max(10000)) }).passthrough().optional(),
  assetsAndLiabilities: z.object({ weeklyRent: money, ...Object.fromEntries(['savings', 'cars', 'carLoans', 'creditCards', 'studentLoan', 'privateHealthInsurance'].map(key => [key, optional(z.string().max(5000))])) }).passthrough().optional(),
  properties: z.object({ items: z.array(property).max(50, 'Add no more than 50 properties.').optional() }).passthrough().optional(),
}).passthrough();

export function validateContinuationDetails(details: Record<string, unknown>): string[] {
  const result = continuationDetailsSchema.safeParse(details);
  return result.success ? [] : result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
}
