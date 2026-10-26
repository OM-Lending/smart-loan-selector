import { z } from 'zod';
import { QUESTIONNAIRE } from '@/config/questionnaire';
import { AddressSelectionSchema, addressInputError } from '@/lib/validations/address';
import { AUSTRALIAN_STATES, propertyLocationInputError } from '@/lib/property-location';

const emptyToUndefinedNumber = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string' && /^0[0-9]+/.test(val)) return NaN; 
  return Number(val);
}, z.number({ error: "Invalid number format" }).min(0).optional());

const strictSalary = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string' && /^0[0-9]+/.test(val)) return NaN;
  return Number(val);
}, z.number({ error: "Invalid salary format" }).min(0, "Salary cannot be negative"));

const dateMMSchema = z.string()
  .regex(/^(0[1-9]|1[0-2])\/\d{4}$/, 'Format must be MM/YYYY')
  .optional()
  .or(z.literal(''));

const optionalChoice = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(
  value => value === '' || value === null ? undefined : value,
  z.enum(values).optional(),
);

export const ApplicationSchema = z.object({
  goal: z.enum(['BUY', 'REFINANCE'], { error: 'Loan goal is required' }),
  buySituation: optionalChoice(['EXPLORING', 'WITHIN_3_TO_6_MONTHS', 'MADE_OFFER', 'EXCHANGED'] as const),
  isFirstHomeBuyer: z.boolean().nullable().optional(),
  
  propertyUse: optionalChoice(['OWNER_OCCUPIED', 'INVESTMENT'] as const),
  propertyStatus: optionalChoice(['ESTABLISHED', 'NEW', 'VACANT_LAND'] as const),
  propertyType: optionalChoice(['HOUSE', 'TOWNHOUSE', 'APARTMENT'] as const),
  propertyPostcode: z.string().regex(/^\d{4}$/, 'Enter a valid 4-digit Australian postcode').optional().or(z.literal('')),
  propertySuburb: z.string().trim().max(100).optional(),
  propertyState: optionalChoice(AUSTRALIAN_STATES),
  propertyLocationSelection: AddressSelectionSchema.optional(),
  purchasePrice: emptyToUndefinedNumber,
  deposit: emptyToUndefinedNumber,
  
  refinanceGoal: optionalChoice(['REDUCE_INTEREST', 'CASH_OUT'] as const),
  cashOutPurpose: z.string().optional(),
  propertyAddress: z.string().trim().max(500).optional(),
  propertyAddressSelection: AddressSelectionSchema.optional(),
  currentLender: z.preprocess(value => value === '' || value === null ? undefined : value,
    z.enum(QUESTIONNAIRE.lenders, { error: 'Select your current lender from the list' }).optional()),
  propertyValue: emptyToUndefinedNumber,
  currentLoanBalance: emptyToUndefinedNumber,
  currentInterestRate: emptyToUndefinedNumber,
  currentRepaymentType: optionalChoice(['P_AND_I', 'INTEREST_ONLY'] as const),
  isFixedRate: z.boolean().nullable().optional(),
  fixedRateExpiry: dateMMSchema,
  
  repaymentStructure: z.enum(['P_AND_I', 'INTEREST_ONLY'], { error: 'Choose a repayment structure' }),
  interestOnlyYears: optionalChoice(['1', '2', '3', '4', '5'] as const),
  ratePreference: z.enum(['VARIABLE', 'FIXED'], { error: 'Choose a rate preference' }),
  fixedYears: optionalChoice(['1', '2', '3'] as const),
  
  employmentStatus: z.enum(['FULL_TIME', 'PART_TIME', 'CASUAL'], { error: 'Choose a valid employment status' }),
  employmentStartDate: dateMMSchema,
  grossAnnualSalary: strictSalary,
  relationshipStatus: z.enum(['NEVER_MARRIED', 'MARRIED', 'DE_FACTO', 'DIVORCED', 'WIDOWED'], { error: 'Choose a valid relationship status' }),
  partnerEmploymentStatus: optionalChoice(['FULL_TIME', 'PART_TIME', 'CASUAL'] as const),
  partnerEmploymentStartDate: dateMMSchema,
  partnerGrossSalary: emptyToUndefinedNumber,
  dependents: z.coerce.number().int().min(0).safe().default(0),
  
  hasExistingLoans: z.boolean().nullable().optional(),
  existingMonthlyRepayment: emptyToUndefinedNumber,
  hasCreditCard: z.boolean().nullable().optional(),
  creditCardLimit: emptyToUndefinedNumber,
  
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().regex(/^4\d{8}$/, 'Enter a 9-digit Australian mobile number after +61')
}).superRefine((data, context) => {
  if (!data.propertyUse) context.addIssue({ code: 'custom', path: ['propertyUse'], message: 'Choose how the property will be used' });
  if (data.goal === 'BUY') {
    const locationError = propertyLocationInputError({ postcode: data.propertyPostcode, suburb: data.propertySuburb, state: data.propertyState }, data.propertyLocationSelection);
    if (locationError) context.addIssue({ code: 'custom', path: ['propertyPostcode'], message: locationError });
    if (!data.purchasePrice || data.purchasePrice <= 0) context.addIssue({ code: 'custom', path: ['purchasePrice'], message: 'Enter a property price greater than zero' });
    if (data.deposit === undefined) context.addIssue({ code: 'custom', path: ['deposit'], message: 'Enter your deposit' });
    if (data.purchasePrice !== undefined && data.deposit !== undefined && data.deposit >= data.purchasePrice) {
      context.addIssue({ code: 'custom', path: ['deposit'], message: 'Deposit must be less than the property price' });
    }
  } else {
    const addressError = addressInputError(data.propertyAddress, data.propertyAddressSelection);
    if (addressError) context.addIssue({ code: 'custom', path: ['propertyAddress'], message: addressError });
    if (!data.currentLender) context.addIssue({ code: 'custom', path: ['currentLender'], message: 'Select your current lender' });
    if (!data.propertyValue || data.propertyValue <= 0) context.addIssue({ code: 'custom', path: ['propertyValue'], message: 'Enter a property value greater than zero' });
    if (!data.currentLoanBalance || data.currentLoanBalance <= 0) context.addIssue({ code: 'custom', path: ['currentLoanBalance'], message: 'Enter your current loan balance' });
    if (data.propertyValue !== undefined && data.currentLoanBalance !== undefined && data.currentLoanBalance > data.propertyValue) {
      context.addIssue({ code: 'custom', path: ['currentLoanBalance'], message: 'Loan balance cannot exceed the property value' });
    }
  }
  if (data.hasExistingLoans && !data.existingMonthlyRepayment) context.addIssue({ code: 'custom', path: ['existingMonthlyRepayment'], message: 'Enter your total monthly repayment greater than zero' });
  if (data.hasCreditCard && !data.creditCardLimit) context.addIssue({ code: 'custom', path: ['creditCardLimit'], message: 'Enter your total credit card limit greater than zero' });
  if (data.repaymentStructure === 'INTEREST_ONLY' && !data.interestOnlyYears) {
    context.addIssue({ code: 'custom', path: ['interestOnlyYears'], message: 'Choose the interest-only period' });
  }
  if (data.ratePreference === 'FIXED' && !data.fixedYears) {
    context.addIssue({ code: 'custom', path: ['fixedYears'], message: 'Choose the fixed-rate period' });
  }
});

export type ApplicationFormInput = z.input<typeof ApplicationSchema>;
export type ApplicationPayload = z.output<typeof ApplicationSchema>;
