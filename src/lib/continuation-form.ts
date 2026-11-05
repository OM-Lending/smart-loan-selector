import type { EmploymentStatus, ResidencyStatus } from '@prisma/client';
import { RELATIONSHIP_OPTIONS } from '@/lib/relationship-status';

export const RESIDENCY_OPTIONS = [
  { value: 'AUSTRALIAN_CITIZEN', label: 'Australian citizen' },
  { value: 'PERMANENT_RESIDENT', label: 'Australian permanent resident' },
  { value: 'TEMPORARY_RESIDENT', label: 'Temporary resident' },
] as const satisfies readonly { value: ResidencyStatus; label: string }[];
export const EMPLOYMENT_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' }, { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CASUAL', label: 'Casual' }, { value: 'SELF_EMPLOYED', label: 'Self-employed' },
] as const satisfies readonly { value: EmploymentStatus; label: string }[];
export type ContinuationField = { path: string; label: string; type?: 'date' | 'number' | 'positiveInteger' | 'textarea' | 'select' | 'address'; placeholder?: string; options?: readonly { value: string; label: string }[] };
type Section = { title: string; note?: string; fields: ContinuationField[] };
const relationshipOptions = RELATIONSHIP_OPTIONS.map(option => ({ value: option.id, label: option.label }));
export const CONTINUATION_SECTIONS: Section[] = [
  { title: 'Applicant 1', note: 'Known details are pre-filled. All fields are optional; provide what you can.', fields: [
    { path: 'applicant.fullName', label: 'Full name' },
    { path: 'applicant.mobile', label: 'Mobile number' }, { path: 'applicant.email', label: 'Email address' },
    { path: 'applicant.visaStatus', label: 'Citizenship or residency status', type: 'select', options: RESIDENCY_OPTIONS },
    { path: 'applicant.maritalStatus', label: 'Marital status', type: 'select', options: relationshipOptions },
    { path: 'applicant.residentialAddress', label: 'Current home address', type: 'address' },
    { path: 'applicant.residentialSince', label: 'Date you moved into your current home', type: 'date' },
    { path: 'applicant.housingArrangement', label: 'Current housing', placeholder: 'Renting, mortgage, living with parents, or fully paid' },
  ] },
  { title: 'Applicant 2 (if applicable)', fields: [
    { path: 'applicant2.fullName', label: 'Full name' },
    { path: 'applicant2.visaStatus', label: 'Citizenship or residency status', type: 'select', options: RESIDENCY_OPTIONS },
    { path: 'applicant2.maritalStatus', label: 'Marital status', type: 'select', options: relationshipOptions },
    { path: 'applicant2.employmentStatus', label: 'Employment type', type: 'select', options: EMPLOYMENT_OPTIONS },
    { path: 'applicant2.annualIncome', label: 'Annual income (AUD)', type: 'positiveInteger' },
  ] },
  { title: 'Current employment', fields: [
    { path: 'currentEmployment.annualIncome', label: 'Annual income before tax (AUD)', type: 'positiveInteger' },
    { path: 'currentEmployment.employmentType', label: 'Employment type', type: 'select', options: EMPLOYMENT_OPTIONS },
    { path: 'currentEmployment.position', label: 'Position / occupation' },
    { path: 'currentEmployment.officePhone', label: 'Employment phone number' },
    { path: 'currentEmployment.officeAddress', label: 'Workplace address', type: 'address' },
    { path: 'currentEmployment.startDate', label: 'Employment start date', type: 'date' },
  ] },
  { title: 'Previous employment (if applicable)', fields: [
    { path: 'previousEmployment.history', label: 'Previous employment history', type: 'textarea', placeholder: 'Position, contact details, workplace address, and start and end dates, if available' },
    { path: 'previousEmployment.officePhone', label: 'Previous employment phone number' },
  ] },
  { title: 'Assets and liabilities', fields: [
    { path: 'assetsAndLiabilities.savings', label: 'Savings (bank and balance)' },
    { path: 'assetsAndLiabilities.cars', label: 'Cars (model, year and estimated value)' },
    { path: 'assetsAndLiabilities.carLoans', label: 'Car loans (lender and balance)' },
    { path: 'assetsAndLiabilities.creditCards', label: 'Credit cards (lender and limit)' },
    { path: 'assetsAndLiabilities.studentLoan', label: 'Student loan balance' },
    { path: 'assetsAndLiabilities.weeklyRent', label: 'Weekly rent expense (AUD)', type: 'number' },
    { path: 'assetsAndLiabilities.privateHealthInsurance', label: 'Private health insurance details' },
  ] },
];

// Apply only to editable forms and new saves. Submitted historical records stay intact.
export function editableContinuationDetails(details: Record<string, unknown>, normalizeLegacyResidency = false): Record<string, unknown> {
  const result = structuredClone(details);
  delete result.thirdParties;
  delete result.loanRequirements;
  const removed: Record<string, string[]> = {
    applicant: ['dateOfBirth', 'dependentBirthDates', 'governmentBenefits'],
    applicant2: ['dateOfBirth', 'dependentBirthDates', 'governmentBenefits'],
    currentEmployment: ['employerName', 'employerContactName', 'employerContactPhone', 'employerContactPosition', 'salaryBank'],
    assetsAndLiabilities: ['homeContents', 'shares', 'superannuation', 'personalLoans'],
  };
  for (const [section, fields] of Object.entries(removed)) {
    const item = result[section];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const values = item as Record<string, unknown>;
      for (const field of fields) delete values[field];
      if (normalizeLegacyResidency && section.startsWith('applicant') && values.visaStatus && !RESIDENCY_OPTIONS.some(option => option.value === values.visaStatus)) {
        // Old free text is not an assertion of one of the new residency categories.
        values.previousVisaStatus = values.visaStatus;
        delete values.visaStatus;
      }
    }
  }
  const properties = result.properties;
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    const items = (properties as Record<string, unknown>).items;
    if (Array.isArray(items)) for (const item of items) {
      if (item && typeof item === 'object' && item.use !== 'INVESTMENT') {
        for (const key of ['marketValue', 'lender', 'loanLimit', 'loanBalance', 'loanStartDate', 'rentalPerWeek', 'leasedThrough']) delete item[key];
      }
    }
  }
  return result;
}
