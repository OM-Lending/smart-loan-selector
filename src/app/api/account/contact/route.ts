import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/server/lib/auth';

export async function GET() {
  const identity = await getAuthenticatedProfile();
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    fullName: identity.profile?.fullName ?? identity.fullName ?? '',
    email: identity.email, phone: identity.profile?.phone ?? '',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
