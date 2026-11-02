const TARGET_BANKS = [
  'Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ', 'CommBank', 'Commonwealth Bank', 'Macquarie', 'ING',
  'Bendigo', 'Bank of Queensland', 'BOQ', 'Bankwest', 'St.George', 'St George',
  'AMP - My AMP', 'Qudos', 'Bank of China', 'BOC', 'La Trobe', 'Pepper', 'Think Tank', 'Brighten',
  'ME Bank',
];

// Explicit exclusions also apply to lenders already stored in the database.
const EXCLUDED_BANKS = ['Citi', 'Citibank'];

function matchesBankName(brandName: string, names: readonly string[]): boolean {
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedName = ` ${normalize(brandName)} `;
  return names.some(name => normalizedName.includes(` ${normalize(name)} `));
}

export function isExcludedCdrLender(brandName: string): boolean {
  return matchesBankName(brandName, EXCLUDED_BANKS);
}

export function isSupportedCdrLender(brandName: string): boolean {
  return !isExcludedCdrLender(brandName) && matchesBankName(brandName, TARGET_BANKS);
}
