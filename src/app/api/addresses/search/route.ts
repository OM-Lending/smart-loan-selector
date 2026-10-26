import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchAustralianAddresses, searchAustralianLocations } from '@/server/services/address.service';
import { isSameOriginRequest } from '@/server/lib/request-origin';

export const runtime = 'nodejs';
const Search = z.object({ query: z.string().trim().max(200), kind: z.enum(['ADDRESS', 'LOCALITY']).default('ADDRESS') }).refine(
  value => value.query.length >= (value.kind === 'LOCALITY' ? 2 : 4),
);
// Best-effort per-instance protection; configure provider quotas as well.
const windows = new Map<string, { count: number; expires: number }>();

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const now = Date.now();
  for (const [ip, window] of windows) if (window.expires <= now) windows.delete(ip);
  if (windows.size >= 1000 && !windows.has(key)) return NextResponse.json({ error: 'Address search is busy. Please try again shortly.' }, { status: 429 });
  const window = windows.get(key) ?? { count: 0, expires: now + 60_000 };
  if (window.count >= 60) return NextResponse.json({ error: 'Too many address searches. Please try again shortly.' }, { status: 429, headers: { 'Retry-After': '60' } });
  window.count++;
  windows.set(key, window);
  const parsed = Search.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter at least four address characters or two postcode/suburb characters.' }, { status: 400 });
  try {
    const suggestions = parsed.data.kind === 'LOCALITY'
      ? await searchAustralianLocations(parsed.data.query)
      : await searchAustralianAddresses(parsed.data.query);
    return NextResponse.json({ suggestions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Do not log the provider URL: it contains the API key and the address.
    return NextResponse.json({ error: 'Address search is unavailable. Try again or enter your address manually.' }, { status: 503 });
  }
}
