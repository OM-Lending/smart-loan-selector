import { z } from 'zod';

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

export const ApplicationSchema = z.object({
  goal: z.enum(['BUY', 'REFINANCE'], { error: 'Loan goal is required' }),
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
  
  repaymentStructure: z.enum(['P_AND_I', 'INTEREST_ONLY'], { error: 'Choose a repayment structure' }),
  interestOnlyYears: z.string().optional(),
  ratePreference: z.enum(['VARIABLE', 'FIXED'], { error: 'Choose a rate preference' }),
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
  
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().regex(/^4\d{8}$/, 'Enter a 9-digit Australian mobile number after +61')
}).superRefine((data, context) => {
  if (!data.propertyUse) context.addIssue({ code: 'custom', path: ['propertyUse'], message: 'Choose how the property will be used' });
  if (data.goal === 'BUY') {
    if (!data.purchasePrice || data.purchasePrice <= 0) context.addIssue({ code: 'custom', path: ['purchasePrice'], message: 'Enter a property price greater than zero' });
    if (data.deposit === undefined) context.addIssue({ code: 'custom', path: ['deposit'], message: 'Enter your deposit' });
    if (data.purchasePrice !== undefined && data.deposit !== undefined && data.deposit >= data.purchasePrice) {
      context.addIssue({ code: 'custom', path: ['deposit'], message: 'Deposit must be less than the property price' });
    }
  } else {
    if (!data.propertyValue || data.propertyValue <= 0) context.addIssue({ code: 'custom', path: ['propertyValue'], message: 'Enter a property value greater than zero' });
    if (!data.currentLoanBalance || data.currentLoanBalance <= 0) context.addIssue({ code: 'custom', path: ['currentLoanBalance'], message: 'Enter your current loan balance' });
    if (data.propertyValue !== undefined && data.currentLoanBalance !== undefined && data.currentLoanBalance > data.propertyValue) {
      context.addIssue({ code: 'custom', path: ['currentLoanBalance'], message: 'Loan balance cannot exceed the property value' });
    }
  }
  if (data.repaymentStructure === 'INTEREST_ONLY' && !data.interestOnlyYears) {
    context.addIssue({ code: 'custom', path: ['interestOnlyYears'], message: 'Choose the interest-only period' });
  }
  if (data.ratePreference === 'FIXED' && !data.fixedYears) {
    context.addIssue({ code: 'custom', path: ['fixedYears'], message: 'Choose the fixed-rate period' });
  }
});

export type ApplicationFormInput = z.input<typeof ApplicationSchema>;
export type ApplicationPayload = z.output<typeof ApplicationSchema>;
