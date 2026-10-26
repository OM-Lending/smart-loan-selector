// Keep separators in the display only. Form values remain unformatted strings.
export function normalizeCurrencyInput(value: string, fractionDigits = 2): string | null {
  const raw = value.replace(/[$,\s]/g, '');
  if (!/^\d*(\.\d*)?$/.test(raw)) return null;
  const [integer, fraction] = raw.split('.');
  if (integer.length > 10 || (fraction !== undefined && (fractionDigits === 0 || fraction.length > fractionDigits))) return null;
  const whole = integer.replace(/^0+(?=\d)/, '') || (fraction !== undefined ? '0' : '');
  return fraction === undefined ? whole : `${whole}.${fraction}`;
}

export function formatCurrencyInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const [integer, fraction] = String(value).split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
}
