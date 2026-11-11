import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { isSameOriginRequest } from '@/server/lib/request-origin';
import { hasCurrentConsent, LegalConsentError, readConsentPayload, recordLegalConsents, requireConsent } from '@/server/services/legal/consent.service';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity || !identity.emailVerified) return NextResponse.json({ error: 'Verify your email and sign in before continuing.' }, { status: 401 });
    const consents = readConsentPayload(await request.json());
    requireConsent(consents, 'termsAccepted');
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`legal-terms:${identity.clerkUserId}`}))`;
      if (await hasCurrentConsent(identity.clerkUserId, 'TERMS_ACCEPTANCE', undefined, tx)) return;
      await recordLegalConsents(tx, [{ purpose: 'TERMS_ACCEPTANCE', flag: consents.quoteTermsAccepted ? 'quoteTermsAccepted' : 'termsAccepted', source: 'REGISTRATION', profileId: identity.profile?.id, clerkUserId: identity.clerkUserId, eventKey: `terms:${identity.clerkUserId}` }]);
    }, { timeout: 15_000 });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof LegalConsentError) return NextResponse.json({ error: error.message, code: error.code }, { status: 428 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    console.error('Terms acceptance could not be recorded.');
    return NextResponse.json({ error: 'Could not record your confirmation. Please retry.' }, { status: 500 });
  }
}
