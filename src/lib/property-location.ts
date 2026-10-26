import { z } from 'zod';
import { AddressSelectionSchema, type AddressSelection } from '@/lib/validations/address';

export const AUSTRALIAN_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA', 'OT'] as const;
export const PostcodeSchema = z.string().regex(/^\d{4}$/, 'Enter a 4-digit Australian postcode').refine(value => value !== '0000', 'Enter a valid Australian postcode');
export const PropertyLocationSchema = z.object({
  postcode: PostcodeSchema,
  suburb: z.string().trim().min(2, 'Enter a suburb').max(100),
  state: z.enum(AUSTRALIAN_STATES, { error: 'Select a state or territory' }),
});
export type PropertyLocation = z.infer<typeof PropertyLocationSchema>;
export type LocationSuggestion = PropertyLocation & { id: string; selection: AddressSelection };

const STATE_NAMES: Record<string, PropertyLocation['state']> = {
  'Australian Capital Territory': 'ACT', 'New South Wales': 'NSW', 'Northern Territory': 'NT',
  Queensland: 'QLD', 'South Australia': 'SA', Tasmania: 'TAS', Victoria: 'VIC', 'Western Australia': 'WA',
  'Other Territories': 'OT', 'Jervis Bay Territory': 'OT', 'Norfolk Island': 'OT',
  'Christmas Island': 'OT', 'Cocos (Keeling) Islands': 'OT',
};

export function normalizeAustralianLocation(raw: unknown): PropertyLocation | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if (item.country_code !== 'au' || !['postcode', 'suburb', 'city', 'district'].includes(String(item.result_type))) return null;
  const code = typeof item.state_code === 'string' ? item.state_code.replace(/^AU-/, '').toUpperCase() : '';
  const result = PropertyLocationSchema.safeParse({
    postcode: item.postcode,
    suburb: item.suburb || item.city || item.town || item.village,
    state: (AUSTRALIAN_STATES as readonly string[]).includes(code) ? code : STATE_NAMES[String(item.state)],
  });
  return result.success ? result.data : null;
}

export function propertyLocationInputError(location: unknown, selection: unknown): string | null {
  const parsed = PropertyLocationSchema.safeParse(location);
  if (!parsed.success) return 'Provide a valid postcode, suburb and state or territory.';
  if (!AddressSelectionSchema.safeParse(selection).success) return 'Select a postcode and suburb from the suggestions, or choose manual entry.';
  return null;
}
