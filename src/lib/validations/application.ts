import { z } from 'zod';

const emptyToUndefinedNumber = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string' && /^0[0-9]+/.test(val)) return NaN; 
  return Number(val);
}, z.number({ invalid_type_error: "Invalid number format" }).optional());

const strictSalary = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string' && /^0[0-9]+/.test(val)) return NaN;
  return Number(val);
}, z.number({ invalid_type_error: "Invalid salary format" }).min(0, "Salary cannot be negative"));

const dateMMSchema = z.string()
  .regex(/^(0[1-9]|1[0-2])\/\d{4}$/, 'Format must be MM/YYYY')
  .optional()
  .or(z.literal(''));

export const ApplicationSchema = z.object({
  goal: z.enum(['BUY', 'REFINANCE'], { required_error: 'Loan goal is required' }),
  buySituation: z.string().optional(),
  isFirstHomeBuyer: z.boolean().nullable().optional(),
  
  propertyUse: z.string().optional(),
  propertyStatus: z.string().optional(),
  propertyType: z.string().optional(),
  propertyPostcode: z.string().optional(),
  purchasePrice: emptyToUndefinedNumber,
  deposit: emptyToUndefinedNumber,
  
  refinanceGoal: z.string().optional(),
  cashOutPurpose: z.string().optional(),
  propertyAddress: z.string().optional(),
  currentLender: z.string().optional(),
  propertyValue: emptyToUndefinedNumber,
  currentLoanBalance: emptyToUndefinedNumber,
  currentInterestRate: emptyToUndefinedNumber,
  currentRepaymentType: z.string().optional(),
  isFixedRate: z.boolean().nullable().optional(),
  fixedRateExpiry: dateMMSchema,
  
  repaymentStructure: z.enum(['P_AND_I', 'INTEREST_ONLY']).optional(),
  interestOnlyYears: z.string().optional(),
  ratePreference: z.enum(['VARIABLE', 'FIXED']).optional(),
  fixedYears: z.string().optional(),
  
  employmentStatus: z.string().min(1, 'Employment status is required'),
  employmentStartDate: dateMMSchema,
  grossAnnualSalary: strictSalary,
  
  relationshipStatus: z.string().min(1, 'Relationship status is required'),
  partnerEmploymentStatus: z.string().optional(),
  partnerEmploymentStartDate: dateMMSchema,
  partnerGrossSalary: emptyToUndefinedNumber,
  dependents: z.coerce.number().min(0).default(0),
  
  hasExistingLoans: z.boolean().nullable().optional(),
  existingMonthlyRepayment: emptyToUndefinedNumber,
  hasCreditCard: z.boolean().nullable().optional(),
  creditCardLimit: emptyToUndefinedNumber,
  
  firstName: z.string().min(2, 'First name must be at least 2 characters').optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional()
});

export type ApplicationPayload = z.infer<typeof ApplicationSchema>;