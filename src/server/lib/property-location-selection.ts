import { createHmac, timingSafeEqual } from 'node:crypto';
import { AddressSelectionSchema } from '@/lib/validations/address';
import { PropertyLocationSchema, propertyLocationInputError, type PropertyLocation } from '@/lib/property-location';

export function signPropertyLocation(location: PropertyLocation, key: string): string {
  const data = JSON.stringify([location.postcode, location.suburb, location.state]);
  return createHmac('sha256', key).update(`property-location:v1:${data}`).digest('base64url');
}

export function checkPropertyLocationSelection(location: unknown, selection: unknown, key?: string): string | null {
  const error = propertyLocationInputError(location, selection);
  if (error) return error;
  const source = AddressSelectionSchema.parse(selection);
  if (source.source === 'MANUAL') return null;
  if (!key) return 'Location search is unavailable. Choose manual entry to confirm your location.';
  const expected = Buffer.from(signPropertyLocation(PropertyLocationSchema.parse(location), key), 'base64url');
  const supplied = Buffer.from(source.token, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return 'Search again and select your postcode and suburb from the suggestions.';
  return null;
}
