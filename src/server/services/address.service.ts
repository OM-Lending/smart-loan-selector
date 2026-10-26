import 'server-only';
import { z } from 'zod';
import { type AddressSuggestion } from '@/lib/validations/address';
import { checkAddressSelection, signAddress } from '@/server/lib/address-selection';
import { normalizeAustralianLocation, type LocationSuggestion } from '@/lib/property-location';
import { signPropertyLocation } from '@/server/lib/property-location-selection';

const Result = z.object({
  formatted: z.string().trim().min(10).max(500), country_code: z.literal('au'),
  street: z.string().min(1), housenumber: z.string().min(1), postcode: z.string().regex(/^\d{4}$/),
  place_id: z.string().optional(),
});
const Response = z.object({ results: z.array(z.unknown()) });

async function search(query: string, locality = false): Promise<unknown[]> {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw new Error('ADDRESS_SEARCH_NOT_CONFIGURED');
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.search = new URLSearchParams({ text: query, filter: 'countrycode:au', lang: 'en', format: 'json', limit: '8', apiKey: key }).toString();
  if (locality) url.searchParams.set('type', 'locality');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('ADDRESS_SEARCH_UNAVAILABLE');
  const body = Response.parse(await response.json());
  return body.results;
}

export async function searchAustralianAddresses(query: string): Promise<AddressSuggestion[]> {
  const results = await search(query);
  const key = process.env.GEOAPIFY_API_KEY!;
  const seen = new Set<string>();
  return results.flatMap(raw => {
    const result = Result.safeParse(raw);
    if (!result.success || seen.has(result.data.formatted)) return [];
    const item = result.data;
    seen.add(item.formatted);
    return [{ id: item.place_id ?? item.formatted, address: item.formatted, postcode: item.postcode,
      selection: { source: 'LOOKUP' as const, token: signAddress(item.formatted, key) } }];
  });
}

export async function searchAustralianLocations(query: string): Promise<LocationSuggestion[]> {
  const results = await search(query, true);
  const key = process.env.GEOAPIFY_API_KEY!;
  const seen = new Set<string>();
  return results.flatMap(raw => {
    const location = normalizeAustralianLocation(raw);
    if (!location) return [];
    const id = JSON.stringify([location.postcode, location.suburb, location.state]);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ ...location, id, selection: { source: 'LOOKUP' as const, token: signPropertyLocation(location, key) } }];
  });
}

export function validateAddressSelection(address: unknown, selection: unknown): string | null {
  return checkAddressSelection(address, selection, process.env.GEOAPIFY_API_KEY);
}
