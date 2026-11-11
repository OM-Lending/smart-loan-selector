import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { hasCurrentConsent } from '@/server/services/legal/consent.service';
import { LEGAL_VERSION } from '@/lib/legal/consent';

export async function GET() {
  const identity = await getAuthenticatedProfile();
  const termsAccepted = identity ? await hasCurrentConsent(identity.clerkUserId, 'TERMS_ACCEPTANCE') : false;
  return NextResponse.json({ version: LEGAL_VERSION, termsAccepted }, { headers: { 'Cache-Control': 'no-store' } });
}
