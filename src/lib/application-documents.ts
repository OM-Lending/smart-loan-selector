import type { ApplicationDocumentCategory } from '@prisma/client';

export const APPLICATION_DOCUMENT_TYPES = [
  { id: 'identity', title: 'Identification', description: 'Passport, driver licence or visa. Include both sides if you upload a driver licence.' },
  { id: 'payslips', title: 'Latest two payslips', description: 'Your two most recent payslips, if available.' },
  { id: 'salary_bank_statements', title: 'Salary bank statements', description: 'Bank statements showing salary payments for the most recent three months.' },
  { id: 'ato_income_statement', title: 'ATO income statement', description: 'Your Australian Taxation Office income statement, if available.' },
  { id: 'car_loan_statement', title: 'Car loan statement', description: 'A recent statement for any car loan you have.' },
  { id: 'student_loan_statement', title: 'Student loan statement', description: 'A recent student loan statement, if you have a student loan.' },
  { id: 'mortgage_statement', title: 'Mortgage statement or summary', description: 'A recent mortgage statement or summary, if you have a home loan. An online banking summary or app screenshot is accepted.' },
  { id: 'council_rates', title: 'Council rates notice', description: 'A council rates notice for the property you are refinancing, if applicable.' },
  { id: 'purchase_contract', title: 'Contract of sale', description: 'Your property purchase contract, if you are buying a property.' },
  { id: 'rental_statement', title: 'Rental statement', description: 'A rental statement supplied by your real estate agent, if applicable.' },
  { id: 'other', title: 'Other supporting material', description: 'Anything else you would like your broker to review.' },
] as const;

// Preserve readable names for documents uploaded under the earlier checklist.
const documentTitles: Record<string, string> = {
  income: 'Income evidence (previous upload)',
  bank_statements: 'Bank statements (previous upload)',
  liabilities: 'Loans and credit cards (previous upload)',
  property: 'Property documents (previous upload)',
  refinance: 'Refinance documents (previous upload)',
  ...Object.fromEntries(APPLICATION_DOCUMENT_TYPES.map(({ id, title }) => [id, title])),
};

export function applicationDocumentTitle(category: string): string {
  return documentTitles[category.toLowerCase()]
    ?? category.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

const documentCategories: Record<string, ApplicationDocumentCategory> = {
  identity: 'IDENTITY',
  payslips: 'PAYSLIPS',
  salary_bank_statements: 'SALARY_BANK_STATEMENTS',
  ato_income_statement: 'ATO_INCOME_STATEMENT',
  car_loan_statement: 'CAR_LOAN_STATEMENT',
  student_loan_statement: 'STUDENT_LOAN_STATEMENT',
  mortgage_statement: 'MORTGAGE_STATEMENT',
  council_rates: 'COUNCIL_RATES',
  purchase_contract: 'PURCHASE_CONTRACT',
  rental_statement: 'RENTAL_STATEMENT',
  other: 'OTHER',
  income: 'INCOME',
  bank_statements: 'BANK_STATEMENTS',
  liabilities: 'LIABILITIES',
  property: 'PROPERTY',
  refinance: 'REFINANCE',
};

export function applicationDocumentCategory(value: string): ApplicationDocumentCategory | undefined {
  return Object.hasOwn(documentCategories, value) ? documentCategories[value] : undefined;
}
