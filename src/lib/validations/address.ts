import { z } from 'zod';

export const AddressSelectionSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('LOOKUP'), token: z.string().min(1).max(4096) }),
  z.object({ source: z.literal('MANUAL'), reason: z.enum(['NOT_FOUND', 'UNAVAILABLE']) }),
]);
export type AddressSelection = z.infer<typeof AddressSelectionSchema>;
export type AddressSuggestion = { id: string; address: string; postcode: string; selection: AddressSelection };

export function addressInputError(address: unknown, selection: unknown): string | null {
  if (typeof address !== 'string' || address.trim().length < 10 || address.length > 500) return 'Enter a complete property address.';
  const result = AddressSelectionSchema.safeParse(selection);
  if (!result.success) return 'Select an address from the suggestions or choose manual entry.';
  if (result.data.source === 'MANUAL' && !/\b\d{4}\b/.test(address)) return 'Include the street, suburb, state and 4-digit postcode.';
  return null;
}
