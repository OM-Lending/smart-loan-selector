import { createHmac, timingSafeEqual } from 'node:crypto';
import { addressInputError, AddressSelectionSchema } from '@/lib/validations/address';

export function signAddress(address: string, key: string): string {
  return createHmac('sha256', key).update(`address-selection:v1:${address}`).digest('base64url');
}

// This receipt attests to a provider suggestion, not ownership or residency.
export function checkAddressSelection(address: unknown, selection: unknown, key?: string): string | null {
  const error = addressInputError(address, selection);
  if (error) return error;
  const parsed = AddressSelectionSchema.parse(selection);
  if (parsed.source === 'MANUAL') return null;
  if (!key) return 'Address search is unavailable. Select manual entry and confirm your address.';
  const supplied = Buffer.from(parsed.token, 'base64url');
  const expected = Buffer.from(signAddress(address as string, key), 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return 'Search again and select your full address from the suggestions.';
  return null;
}
