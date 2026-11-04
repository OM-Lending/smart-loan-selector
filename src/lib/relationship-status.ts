export const RELATIONSHIP_STATUSES = ['SINGLE', 'MARRIED', 'DE_FACTO'] as const;
export type CurrentRelationshipStatus = typeof RELATIONSHIP_STATUSES[number];

export const RELATIONSHIP_OPTIONS = [
  { id: 'SINGLE', label: 'Single' },
  { id: 'MARRIED', label: 'Married' },
  { id: 'DE_FACTO', label: 'De facto' },
] as const;

export function normalizeRelationshipStatus(value: unknown): CurrentRelationshipStatus | undefined {
  switch (value) {
    case 'SINGLE':
    case 'NEVER_MARRIED':
    case 'DIVORCED':
    case 'WIDOWED':
      return 'SINGLE';
    case 'MARRIED': return 'MARRIED';
    case 'DE_FACTO': return 'DE_FACTO';
    // The historical combined answer cannot identify either current option.
    default: return undefined;
  }
}

export function normalizeApplicantMaritalStatuses(details: Record<string, unknown>, preserveHistoricalCombined = false): Record<string, unknown> {
  const normalized = { ...details };
  for (const key of ['applicant', 'applicant2']) {
    const applicant = details[key];
    if (!applicant || typeof applicant !== 'object' || Array.isArray(applicant)) continue;
    const data = applicant as Record<string, unknown>;
    const status = normalizeRelationshipStatus(data.maritalStatus);
    if (status) normalized[key] = { ...data, maritalStatus: status };
    else if (data.maritalStatus === 'MARRIED_DE_FACTO' && !preserveHistoricalCombined) normalized[key] = { ...data, maritalStatus: '' };
  }
  return normalized;
}
