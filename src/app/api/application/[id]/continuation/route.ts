import { LegalConsentError, readConsentPayload, requireConsent, hasCurrentConsent, recordLegalConsents } from '@/server/services/legal/consent.service';
import { ConsentPayloadSchema, LEGAL_VERSION } from '@/lib/legal/consent';
import { isSameOriginRequest } from '@/server/lib/request-origin';
import { businessProfileForResponse } from '@/server/services/self-employment-records';
import { continuationRecordsInclude, continuationDetailsForResponse, saveContinuationRecords } from '@/server/services/continuation-records';
import { editableContinuationDetails, RESIDENCY_OPTIONS } from '@/lib/continuation-form';
import { validateContinuationDetails } from '@/lib/validations/continuation';
import { after, NextResponse } from 'next/server';
import { enqueueAdminNotification, tryAdminNotifications } from '@/server/services/notifications/notification.service';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { validateContinuationAddresses } from '@/server/services/continuation-addresses';
import { normalizeApplicantMaritalStatuses, normalizeRelationshipStatus, RELATIONSHIP_STATUSES } from '@/lib/relationship-status';

const Params = z.object({ id: z.string().uuid() });
const SaveBody = z.object({
  consents: ConsentPayloadSchema.optional(),
  quoteId: z.string().uuid().optional(),
  details: z.record(z.string(), z.unknown()),
  submit: z.boolean().optional().default(false),
});

function responseQuote(quote: { id: string; lenderName: string; productName: string; quotedRate: { toString(): string }; quotedRateType: string; quotedRepayment: string }) {
  return { id: quote.id, lenderName: quote.lenderName, productName: quote.productName, rate: quote.quotedRate.toString(), rateType: quote.quotedRateType, repayment: quote.quotedRepayment };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = Params.parse(await context.params);
    const application = await prisma.application.findFirst({
      where: { id, userId: identity.profile.id },
      select: { id: true, goal: true, currentStage: true, employmentStatus: true, employmentStartDate: true, grossAnnualSalary: true, partnerEmploymentStatus: true, partnerGrossSalary: true, partnerEmploymentStartDate: true, businessProfiles: true, relationshipStatus: true, user: { select: { fullName: true, email: true, phone: true } }, continuation: { include: { ...continuationRecordsInclude, selectedQuote: true, documents: { orderBy: { uploadedAt: 'desc' } } } } },
    });
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const continuation = application.continuation;
    const [collectionAccepted, termsAccepted] = await Promise.all([
      hasCurrentConsent(identity.clerkUserId, 'APPLICATION_COLLECTION', id),
      hasCurrentConsent(identity.clerkUserId, 'TERMS_ACCEPTANCE'),
    ]);
    return NextResponse.json({
      legal: { version: LEGAL_VERSION, collectionAccepted, termsAccepted },
      applicationId: application.id,
      goal: application.goal,
      currentStage: application.currentStage,
      customer: application.user,
      knownAnswers: {
        employmentStatus: application.employmentStatus,
        employmentStartDate: application.employmentStartDate,
        annualIncome: application.grossAnnualSalary?.toString() ?? '',
        selfEmployment: businessProfileForResponse(application.businessProfiles.find(profile => profile.applicantNumber === 1)),
        partnerSelfEmployment: businessProfileForResponse(application.businessProfiles.find(profile => profile.applicantNumber === 2)),
        partnerEmploymentStatus: application.partnerEmploymentStatus,
        partnerAnnualIncome: application.partnerGrossSalary?.toString() ?? '',
        maritalStatus: normalizeRelationshipStatus(application.relationshipStatus) ?? '',
      },
      continuation: continuation ? {
        id: continuation.id,
        status: continuation.status,
        reviewStatus: continuation.reviewStatus,
        brokerNote: continuation.brokerNote,
        submittedAt: continuation.submittedAt?.toISOString() ?? null,
        details: normalizeApplicantMaritalStatuses(
          continuationDetailsForResponse(continuation),
          continuation.status === 'SUBMITTED' && continuation.reviewStatus !== 'NEEDS_INFORMATION',
        ),
        selectedQuote: responseQuote(continuation.selectedQuote),
        documents: continuation.documents.map(({ id, category, fileName, contentType, sizeBytes, uploadedAt }) => ({ id, category: category.toLowerCase(), fileName, contentType, sizeBytes, uploadedAt })),
      } : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    console.error('Failed to load continuation draft:', error);
    return NextResponse.json({ error: 'Could not load application details' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const profileId = identity.profile.id;
    const { id } = Params.parse(await context.params);
    const parsed = SaveBody.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid application details', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { quoteId, submit } = parsed.data;
    const details = editableContinuationDetails(normalizeApplicantMaritalStatuses(parsed.data.details));
    if (JSON.stringify(details).length > 100_000) return NextResponse.json({ error: 'Application details are too large' }, { status: 413 });

    const application = await prisma.application.findFirst({ where: { id, userId: identity.profile.id }, select: { id: true } });
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const existing = await prisma.applicationContinuation.findUnique({ where: { applicationId: id } });
    if (existing?.status === 'SUBMITTED' && existing.reviewStatus !== 'NEEDS_INFORMATION') {
      return NextResponse.json({ error: 'This application has already been submitted' }, { status: 409 });
    }
    const consents = readConsentPayload(parsed.data.consents);
    const [collectionAlreadyAccepted, termsAlreadyAccepted] = await Promise.all([
      hasCurrentConsent(identity.clerkUserId, 'APPLICATION_COLLECTION', id),
      hasCurrentConsent(identity.clerkUserId, 'TERMS_ACCEPTANCE'),
    ]);
    if (!collectionAlreadyAccepted) requireConsent(consents, 'collectionAccepted');
    if (!termsAlreadyAccepted) requireConsent(consents, 'termsAccepted');
    if (submit) requireConsent(consents, 'submissionConfirmed');
    // Drafts may omit an answer, but any chosen status must be a current option.
    for (const key of ['applicant', 'applicant2']) {
      const applicant = details[key];
      if (!applicant || typeof applicant !== 'object' || Array.isArray(applicant)) continue;
      const residency = (applicant as Record<string, unknown>).visaStatus;
      if (residency !== undefined && residency !== null && residency !== '' && !RESIDENCY_OPTIONS.some(option => option.value === residency)) {
        return NextResponse.json({ error: 'Choose Australian citizen, Australian permanent resident or Temporary resident.' }, { status: 400 });
      }
      const status = (applicant as Record<string, unknown>).maritalStatus;
      if (status !== undefined && status !== null && status !== '' && !RELATIONSHIP_STATUSES.some(option => option === status)) {
        return NextResponse.json({ error: 'Choose Single, Married or De facto for marital status.' }, { status: 400 });
      }
    }
    const addressErrors = validateContinuationAddresses(details, existing?.details);
    if (addressErrors.length) return NextResponse.json({ error: addressErrors.join(' ') }, { status: 400 });
    const resolvedQuoteId = quoteId ?? existing?.selectedQuoteId;
    if (!resolvedQuoteId) return NextResponse.json({ error: 'Choose a product before continuing' }, { status: 400 });
    const quote = await prisma.applicationQuote.findFirst({ where: { id: resolvedQuoteId, applicationId: id }, select: { id: true } });
    if (!quote) return NextResponse.json({ error: 'Selected product not found' }, { status: 404 });

    {
      const validationErrors = validateContinuationDetails(details);
      if (validationErrors.length) return NextResponse.json({
        error: 'Review the information you provided and correct any invalid values before saving. You can leave any field blank.',
        validationErrors,
      }, { status: 400 });
    }

    const jsonDetails = details as Prisma.InputJsonValue;
    const { continuation, notificationEventId } = await prisma.$transaction(async tx => {
      // Serialize concurrent final submissions so one submission creates one event.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`continuation:${id}`}))`;
      const existing = await tx.applicationContinuation.findUnique({ where: { applicationId: id }, include: { selectedQuote: true } });
      if (existing?.status === 'SUBMITTED' && existing.reviewStatus !== 'NEEDS_INFORMATION') return { continuation: existing, notificationEventId: null };
      const continuation = existing
        ? await tx.applicationContinuation.update({
            where: { id: existing.id },
            data: {
              selectedQuoteId: resolvedQuoteId,
              details: jsonDetails,
              formVersion: 2,
              ...(submit
                ? { status: 'SUBMITTED' as const, reviewStatus: 'NEW' as const, brokerNote: null, submittedAt: new Date() }
                : existing.status === 'SUBMITTED'
                  ? { status: 'DRAFT' as const, reviewStatus: 'NEW' as const, brokerNote: null, submittedAt: null }
                  : {}),
            },
            include: { selectedQuote: true },
          })
        : await tx.applicationContinuation.create({
            data: {
              applicationId: id,
              selectedQuoteId: resolvedQuoteId,
              details: jsonDetails,
              formVersion: 2,
              ...(submit ? { status: 'SUBMITTED' as const, submittedAt: new Date() } : {}),
            },
            include: { selectedQuote: true },
          });

      await recordLegalConsents(tx, [
        ...(!termsAlreadyAccepted ? [{ purpose: 'TERMS_ACCEPTANCE' as const, flag: 'termsAccepted' as const, source: 'CONTINUATION' as const, profileId, clerkUserId: identity.clerkUserId, eventKey: `terms:${identity.clerkUserId}` }] : []),
        ...(!collectionAlreadyAccepted ? [{ purpose: 'APPLICATION_COLLECTION' as const, flag: 'collectionAccepted' as const, source: 'CONTINUATION' as const, profileId, clerkUserId: identity.clerkUserId, applicationId: id, eventKey: `collection:${id}` }] : []),
        ...(submit ? [{ purpose: 'APPLICATION_SUBMISSION' as const, flag: 'submissionConfirmed' as const, source: 'FINAL_SUBMISSION' as const, profileId, clerkUserId: identity.clerkUserId, applicationId: id, eventKey: `submission:${id}:${continuation.submittedAt!.toISOString()}` }] : []),
      ]);
      await saveContinuationRecords(tx, continuation.id, details);

      await tx.application.updateMany({
        where: { id, userId: profileId, applyClickedAt: null },
        data: { applyClickedAt: new Date() },
      });

      if (submit) {
        await tx.application.update({ where: { id }, data: { currentStage: 'BROKER_REVIEW' } });
      } else if (existing?.status === 'SUBMITTED') {
        await tx.application.update({ where: { id }, data: { currentStage: 'DOCUMENTS_PENDING' } });
      } else {
        await tx.application.updateMany({
          where: { id, userId: profileId, currentStage: { in: ['LEAD_CAPTURED', 'QUOTED', 'RECOMMENDATION_SENT'] } },
          data: { currentStage: 'APPLICATION_STARTED' },
        });
      }

      const notification = submit ? await enqueueAdminNotification(tx, {
        key: `application.submitted:${id}:${continuation.submittedAt!.toISOString()}`,
        type: 'APPLICATION_SUBMITTED', applicationId: id,
      }) : null;
      return { continuation, notificationEventId: notification?.id ?? null };
    }, { timeout: 15_000 });
    if (notificationEventId) after(() => tryAdminNotifications(notificationEventId));

    return NextResponse.json({ success: true, status: continuation.status, reviewStatus: continuation.reviewStatus, continuationId: continuation.id, selectedQuote: responseQuote(continuation.selectedQuote) });
  } catch (error) {
    if (error instanceof LegalConsentError) return NextResponse.json({ error: error.message, code: error.code }, { status: 428 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    console.error('Failed to save continuation draft:', error);
    return NextResponse.json({ error: 'Could not save application details' }, { status: 500 });
  }
}
