export const QUESTIONNAIRE = {
  buySituations: [
    { id: 'EXPLORING', label: 'Just exploring options' },
    { id: 'WITHIN_3_TO_6_MONTHS', label: 'Plan to buy in the next three to six months' },
    { id: 'MADE_OFFER', label: 'Made an offer' },
    { id: 'EXCHANGED', label: 'Exchanged contracts' },
  ],
  propertyUses: [
    { id: 'OWNER_OCCUPIED', label: 'I will live there' },
    { id: 'INVESTMENT', label: 'It\'s an investment' },
  ],
  propertyStatuses: [
    { id: 'ESTABLISHED', label: 'Established home' },
    { id: 'NEW', label: 'Newly built / off the plan' },
    { id: 'VACANT_LAND', label: 'Vacant land to build on' },
  ],
  propertyTypes: [
    { id: 'HOUSE', label: 'House' },
    { id: 'TOWNHOUSE', label: 'Townhouse' },
    { id: 'APARTMENT', label: 'Apartment / Unit' },
  ],
  refinanceGoals: [
    { id: 'REDUCE_INTEREST', label: 'Reduce loan interest' },
    { id: 'CASH_OUT', label: 'Cash out' },
  ],
  repaymentStructures: [
    { id: 'P_AND_I', label: 'Principal & Interest' },
    { id: 'INTEREST_ONLY', label: 'Interest Only' },
  ],
  ratePreferences: [
    { id: 'VARIABLE', label: 'Variable rate' },
    { id: 'FIXED', label: 'Fixed rate' },
  ],
  interestOnlyYears: ['1', '2', '3', '4', '5'],
  fixedYears: ['1', '2', '3'],
  employmentStatuses: [
    { id: 'FULL_TIME', label: 'Full-time' },
    { id: 'PART_TIME', label: 'Part-time' },
    { id: 'CASUAL', label: 'Casual' },
  ] as const,
  relationshipStatuses: [
    { id: 'NEVER_MARRIED', label: 'Never married' },
    { id: 'MARRIED', label: 'Married' },
    { id: 'DE_FACTO', label: 'De facto' },
    { id: 'DIVORCED', label: 'Divorced' },
    { id: 'WIDOWED', label: 'Widowed' },
  ] as const,
  // Standardized Boolean Options
  booleanOptions: [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' },
  ],
  // Australian Lenders for Refinance Search
  lenders: [
    'Commonwealth Bank (CBA)', 
    'Westpac', 
    'NAB', 
    'ANZ', 
    'Macquarie Bank', 
    'ING', 
    'Bendigo Bank', 
    'Bank of Queensland (BOQ)',
    'Suncorp Bank', 
    'AMP Bank', 
    'St.George Bank', 
    'Bankwest', 
    'Me Bank', 
    'HSBC', 
    'Other'
  ]
};
