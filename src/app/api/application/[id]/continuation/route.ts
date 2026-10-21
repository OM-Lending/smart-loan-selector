import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';

const Params = z.object({ id: z.string().uuid() });
const SaveBody = z.object({
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
      select: { id: true, goal: true, currentStage: true, employmentStatus: true, employmentStartDate: true, grossAnnualSalary: true, relationshipStatus: true, user: { select: { fullName: true, email: true, phone: true } }, continuation: { include: { selectedQuote: true, documents: { orderBy: { uploadedAt: 'desc' } } } } },
    });
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const continuation = application.continuation;
    return NextResponse.json({
      applicationId: application.id,
      goal: application.goal,
      currentStage: application.currentStage,
      customer: application.user,
      knownAnswers: {
        employmentStatus: application.employmentStatus,
        employmentStartDate: application.employmentStartDate,
        annualIncome: application.grossAnnualSalary.toString(),
        maritalStatus: application.relationshipStatus,
      },
      continuation: continuation ? {
        id: continuation.id,
        status: continuation.status,
        reviewStatus: continuation.reviewStatus,
        brokerNote: continuation.brokerNote,
        submittedAt: continuation.submittedAt?.toISOString() ?? null,
        details: continuation.details,
        selectedQuote: responseQuote(continuation.selectedQuote),
        documents: continuation.documents.map(({ id, category, fileName, contentType, sizeBytes, uploadedAt }) => ({ id, category, fileName, contentType, sizeBytes, uploadedAt })),
      } : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    console.error('Failed to load continuation draft:', error);
    return NextResponse.json({ error: 'Could not load application details' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const profileId = identity.profile.id;
    const { id } = Params.parse(await context.params);
    const parsed = SaveBody.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid application details', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { quoteId, details, submit } = parsed.data;
    if (JSON.stringify(details).length > 100_000) return NextResponse.json({ error: 'Application details are too large' }, { status: 413 });

    const application = await prisma.application.findFirst({ where: { id, userId: identity.profile.id }, select: { id: true } });
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const existing = await prisma.applicationContinuation.findUnique({ where: { applicationId: id } });
    if (existing?.status === 'SUBMITTED' && existing.reviewStatus !== 'NEEDS_INFORMATION') {
      return NextResponse.json({ error: 'This application has already been submitted' }, { status: 409 });
    }
    const resolvedQuoteId = quoteId ?? existing?.selectedQuoteId;
    if (!resolvedQuoteId) return NextResponse.json({ error: 'Choose a product before continuing' }, { status: 400 });
    const quote = await prisma.applicationQuote.findFirst({ where: { id: resolvedQuoteId, applicationId: id }, select: { id: true } });
    if (!quote) return NextResponse.json({ error: 'Selected product not found' }, { status: 404 });

    if (submit) {
      const applicant = details.applicant && typeof details.applicant === 'object' ? details.applicant as Record<string, unknown> : {};
      const applicant2 = details.applicant2 && typeof details.applicant2 === 'object' ? details.applicant2 as Record<string, unknown> : {};
      const employment = details.currentEmployment && typeof details.currentEmployment === 'object' ? details.currentEmployment as Record<string, unknown> : {};
      const assets = details.assetsAndLiabilities && typeof details.assetsAndLiabilities === 'object' ? details.assetsAndLiabilities as Record<string, unknown> : {};
      const loanRequirements = details.loanRequirements && typeof details.loanRequirements === 'object' ? details.loanRequirements as Record<string, unknown> : {};
      const docs = await prisma.applicationDocument.findMany({ where: { continuationId: existing?.id ?? '00000000-0000-0000-0000-000000000000' }, select: { category: true } });
      const uploaded = new Set(docs.map(item => item.category));
      const missing = [
        ['applicant.fullName', applicant.fullName],
        ['applicant.dateOfBirth', applicant.dateOfBirth],
        ['applicant.mobile', applicant.mobile],
        ['applicant.email', applicant.email],
        ['applicant.visaStatus', applicant.visaStatus],
        ['applicant.maritalStatus', applicant.maritalStatus],
        ['applicant.residentialAddress', applicant.residentialAddress],
        ['applicant.residentialSince', applicant.residentialSince],
        ['currentEmployment.employerName', employment.employerName],
        ['currentEmployment.position', employment.position],
        ['currentEmployment.startDate', employment.startDate],
        ['currentEmployment.employerContactName', employment.employerContactName],
        ['currentEmployment.employerContactPhone', employment.employerContactPhone],
        ['currentEmployment.employerContactPosition', employment.employerContactPosition],
        ['currentEmployment.annualIncome', employment.annualIncome],
        ['currentEmployment.employmentType', employment.employmentType],
        ['assetsAndLiabilities.savings (enter None if not applicable)', assets.savings],
        ['assetsAndLiabilities.creditCards (enter None if not applicable)', assets.creditCards],
        ['loanRequirements.loan1', loanRequirements.loan1],
      ].filter(([, value]) => !String(value ?? '').trim()).map(([key]) => key as string);

      const validationErrors: string[] = [];
      const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
      const positiveInteger = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
      const validPhone = (value: unknown) => typeof value === 'string' && /^\+?[0-9() -]{8,24}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 8 && (value.match(/\d/g)?.length ?? 0) <= 15;
      if (applicant.maritalStatus !== 'SINGLE' && applicant.maritalStatus !== 'MARRIED_DE_FACTO') validationErrors.push('Choose a valid marital status.');
      if (!['FULL_TIME', 'PART_TIME', 'CASUAL', 'SELF_EMPLOYED'].includes(String(employment.employmentType))) validationErrors.push('Choose a valid employment type.');
      if (!positiveInteger(employment.annualIncome)) validationErrors.push('Annual income must be a positive whole number without a leading zero.');
      if (applicant2.annualIncome !== undefined && String(applicant2.annualIncome).trim() !== '' && !positiveInteger(applicant2.annualIncome)) validationErrors.push('Applicant 2 annual income must be a positive whole number without a leading zero.');
      if (applicant2.maritalStatus && !['SINGLE', 'MARRIED_DE_FACTO'].includes(String(applicant2.maritalStatus))) validationErrors.push('Choose a valid marital status for Applicant 2.');
      if (applicant2.employmentStatus && !['FULL_TIME', 'PART_TIME', 'CASUAL', 'SELF_EMPLOYED'].includes(String(applicant2.employmentStatus))) validationErrors.push('Choose a valid employment type for Applicant 2.');
      if (!validDate(applicant.dateOfBirth) || new Date(`${applicant.dateOfBirth}T00:00:00`) >= new Date()) validationErrors.push('Enter a valid date of birth for Applicant 1.');
      if (typeof applicant.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) validationErrors.push('Enter a valid email address.');
      if (!validPhone(applicant.mobile)) validationErrors.push('Enter a valid mobile number.');
      if (!validDate(applicant.residentialSince) || new Date(`${applicant.residentialSince}T00:00:00`) > new Date()) validationErrors.push('Enter a valid date for when you moved into your current home.');
      if (!validDate(employment.startDate) || new Date(`${employment.startDate}T00:00:00`) > new Date()) validationErrors.push('Enter a valid employment start date.');
      if (!validPhone(employment.employerContactPhone)) validationErrors.push('Enter a valid phone number for the employer contact.');

      const dependentCount = Number(applicant.dependents ?? 0);
      const dependentDates = Array.isArray(applicant.dependentBirthDates) ? applicant.dependentBirthDates : [];
      if (!Number.isInteger(dependentCount) || dependentCount < 0 || dependentCount > 5) validationErrors.push('Choose between 0 and 5 dependent children.');
      else if (dependentDates.length !== dependentCount || dependentDates.some(date => !validDate(date) || new Date(`${date}T00:00:00`) >= new Date())) validationErrors.push('Enter a valid date of birth for each dependent child.');

      if (validDate(applicant.residentialSince)) {
        const movedIn = new Date(`${applicant.residentialSince}T00:00:00`);
        const historyCutoff = new Date(movedIn);
        historyCutoff.setFullYear(historyCutoff.getFullYear() - 3);
        if (movedIn > historyCutoff) {
          const rows = Array.isArray(applicant.previousAddresses) ? applicant.previousAddresses as Record<string, unknown>[] : [];
          const parsedRows = rows.map(row => ({
            address: typeof row.address === 'string' ? row.address.trim() : '',
            from: validDate(row.moveInDate) ? new Date(`${row.moveInDate}T00:00:00`) : null,
            to: validDate(row.moveOutDate) ? new Date(`${row.moveOutDate}T00:00:00`) : null,
          }));
          if (!parsedRows.length || parsedRows.some(row => !row.address || !row.from || !row.to || row.to < row.from || row.to >= movedIn)) {
            validationErrors.push('Add each previous address with valid move-in and move-out dates.');
          } else {
            parsedRows.sort((a, b) => a.from!.getTime() - b.from!.getTime());
            const first = parsedRows[0];
            const last = parsedRows[parsedRows.length - 1];
            const coversStart = first.from! <= historyCutoff;
            const coversCurrentMove = last.to!.getTime() >= movedIn.getTime() - 24 * 60 * 60 * 1000;
            const noGaps = parsedRows.every((row, index) => index === 0 || row.from!.getTime() <= parsedRows[index - 1].to!.getTime() + 24 * 60 * 60 * 1000);
            if (!coversStart || !coversCurrentMove || !noGaps) validationErrors.push('Previous address dates must cover the three years before your current address, without gaps.');
          }
        }
      }

      for (const category of ['identity', 'income']) if (!uploaded.has(category)) missing.push(`document:${category}`);
      if (missing.length || validationErrors.length) return NextResponse.json({
        error: 'Review the required fields and correct the highlighted information before submitting.',
        missing,
        validationErrors,
      }, { status: 400 });
    }

    const jsonDetails = details as Prisma.InputJsonValue;
    const continuation = await prisma.$transaction(async tx => {
      const continuation = existing
        ? await tx.applicationContinuation.update({
            where: { id: existing.id },
            data: {
              selectedQuoteId: resolvedQuoteId,
              details: jsonDetails,
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
              ...(submit ? { status: 'SUBMITTED' as const, submittedAt: new Date() } : {}),
            },
            include: { selectedQuote: true },
          });

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

      return continuation;
    });

    return NextResponse.json({ success: true, status: continuation.status, reviewStatus: continuation.reviewStatus, continuationId: continuation.id, selectedQuote: responseQuote(continuation.selectedQuote) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    console.error('Failed to save continuation draft:', error);
    return NextResponse.json({ error: 'Could not save application details' }, { status: 500 });
  }
}
