import 'server-only';
import { validateAddressSelection } from '@/server/services/address.service';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function validateContinuationAddresses(details: Record<string, unknown>, previous: unknown): string[] {
  const saved = object(previous);
  const errors: string[] = [];
  function check(address: unknown, selection: unknown, savedAddress: unknown, label: string) {
    if (!address) return; // Incomplete drafts are allowed; submission checks required fields.
    if (typeof address === 'string' && address === savedAddress) return; // Retain previously saved and legacy addresses.
    const error = validateAddressSelection(address, selection);
    if (error) errors.push(`${label}: ${error}`);
  }
  for (const [section, field, label] of [
    ['applicant', 'residentialAddress', 'Current home address'],
    ['currentEmployment', 'officeAddress', 'Workplace address'],
  ]) {
    const values = object(details[section]);
    check(values[field], values[`${field}Selection`], object(saved[section])[field], label);
  }
  const rows = object(details.applicant).previousAddresses;
  const savedRows = object(saved.applicant).previousAddresses;
  const savedAddresses = Array.isArray(savedRows) ? savedRows.map(row => object(row).address) : [];
  if (Array.isArray(rows)) rows.forEach((row, index) => {
    const item = object(row);
    check(item.address, item.selection, savedAddresses.find(address => address === item.address), `Previous address ${index + 1}`);
  });
  return errors;
}
