export const APPLICATION_DOCUMENT_TYPES = [
  { id: 'identity', title: 'Identity', required: true, description: 'Passport or Australian driver licence. Include both sides if you use a driver licence.' },
  { id: 'income', title: 'Income evidence', required: true, description: 'Recent payslips; self-employed applicants can provide tax returns and financial statements.' },
  { id: 'bank_statements', title: 'Bank statements', description: 'Recent statements for salary, savings and accounts used for expenses or deposit.' },
  { id: 'liabilities', title: 'Loans and credit cards', description: 'Current statements showing lender, limit/balance and repayments.' },
  { id: 'property', title: 'Property documents', description: 'Contract of sale, rates notice or rental statement, if relevant.' },
  { id: 'refinance', title: 'Refinance documents', description: 'Current loan statement and payout details, if refinancing.' },
  { id: 'other', title: 'Other supporting material', description: 'Anything else you would like the broker to consider.' },
] as const;

const documentTitles: Record<string, string> = Object.fromEntries(
  APPLICATION_DOCUMENT_TYPES.map(({ id, title }) => [id, title]),
);

export function applicationDocumentTitle(category: string): string {
  return documentTitles[category]
    ?? category.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
