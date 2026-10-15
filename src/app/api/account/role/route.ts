import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/server/lib/auth';

export async function GET() {
  const identity = await getAuthenticatedProfile();
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    { role: identity.profile?.deletedAt ? null : identity.profile?.role ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
