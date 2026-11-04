import { after, NextResponse } from 'next/server';
import { enqueueAdminNotification, tryAdminNotifications } from '@/server/services/notifications/notification.service';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ContactDetailsSchema, LoanApplicationSchema, normalizeApplicationAnswers, type ContactDetails } from '@/lib/validations/application';
import { ApplicationProfileError, resolveApplicationProfile } from '@/server/lib/application-profile';
import { validateAddressSelection } from '@/server/services/address.service';
import { checkPropertyLocationSelection } from '@/server/lib/property-location-selection';
import { 
  generateRecommendations, 
  NotFoundError, 
  ValidationError 
} from '@/server/services/recommendation.service';

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const identity = await getAuthenticatedProfile();
    if (!identity) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing session', diagnostic: { code: 'CLERK_SESSION_NOT_READY', stage: 'auth_session', requestId } },
        { status: 401 }
      );
    }

    // Parse and validate incoming payload
    const body = await request.json();
    const validationResult = LoanApplicationSchema.safeParse(body && typeof body === 'object' && !Array.isArray(body) ? normalizeApplicationAnswers(body) : body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid application data', 
          details: validationResult.error.flatten().fieldErrors 
        }, 
        { status: 400 }
      );
    }

    const validData = validationResult.data;
    if (validData.goal === 'BUY') {
      const locationError = checkPropertyLocationSelection({ postcode: validData.propertyPostcode, suburb: validData.propertySuburb, state: validData.propertyState }, validData.propertyLocationSelection, process.env.GEOAPIFY_API_KEY);
      if (locationError) return NextResponse.json({ error: locationError, details: { propertyPostcode: [locationError] } }, { status: 400 });
    }
    if (validData.goal === 'REFINANCE') {
      const addressError = validateAddressSelection(validData.propertyAddress, validData.propertyAddressSelection);
      if (addressError) return NextResponse.json({ error: addressError, details: { propertyAddress: [addressError] } }, { status: 400 });
    }
    if (!identity.emailVerified) {
      return NextResponse.json(
        {
          error: 'Verify the same email address before saving your application.',
          diagnostic: {
            code: 'EMAIL_NOT_VERIFIED',
            stage: 'email_verification',
            requestId,
          },
        },
        { status: 403 }
      );
    }
    let contact: ContactDetails | undefined;
    if (!identity.profile) {
      const contactResult = ContactDetailsSchema.safeParse(body);
      if (!contactResult.success) return NextResponse.json({
        error: 'Complete your contact details once before creating your first application.',
        details: contactResult.error.flatten().fieldErrors,
        diagnostic: { code: 'CONTACT_DETAILS_REQUIRED', stage: 'contact_details', requestId },
      }, { status: 400 });
      contact = contactResult.data;
      if (contact.email.trim().toLowerCase() !== identity.email) return NextResponse.json({
        error: 'Use the verified email address for your signed-in account.',
        diagnostic: { code: 'VERIFIED_EMAIL_MISMATCH', stage: 'email_verification', requestId },
      }, { status: 403 });
    }
    const applicationData = validData;

    // Get the application ID
    const { applicationId: createdApplicationId, userId: createdApplicationOwnerId, notificationEventId } = await prisma.$transaction(async (tx) => {
      const profile = await resolveApplicationProfile(tx, identity, contact);

      // 2. Persist loan application data
      const application = await tx.application.create({
        data: {
          userId: profile.id,
          goal: applicationData.goal,
          buySituation: applicationData.buySituation,
          isFirstHomeBuyer: applicationData.isFirstHomeBuyer,
          propertyUse: applicationData.propertyUse,
          propertyStatus: applicationData.propertyStatus,
          propertyType: applicationData.propertyType,
          propertyPostcode: applicationData.propertyPostcode,
          propertySuburb: applicationData.goal === 'BUY' ? applicationData.propertySuburb : undefined,
          propertyState: applicationData.goal === 'BUY' ? applicationData.propertyState : undefined,
          purchasePrice: applicationData.purchasePrice,
          deposit: applicationData.deposit,
          refinanceGoal: applicationData.refinanceGoal,
          cashOutPurpose: applicationData.cashOutPurpose,
          propertyAddress: applicationData.propertyAddress,
          // Store the actual lender name for broker review, rather than the
          // form's "Other" sentinel. Custom names are validated by the schema.
          currentLender: applicationData.goal === 'REFINANCE'
            ? applicationData.currentLender === 'Other' ? applicationData.currentLenderOther : applicationData.currentLender
            : undefined,
          propertyValue: applicationData.propertyValue,
          currentLoanBalance: applicationData.currentLoanBalance,
          currentInterestRate: applicationData.currentInterestRate,
          currentRepaymentType: applicationData.currentRepaymentType,
          isFixedRate: applicationData.isFixedRate,
          fixedRateExpiry: applicationData.fixedRateExpiry,
          repaymentStructure: applicationData.repaymentStructure!,
          interestOnlyYears: applicationData.interestOnlyYears,
          ratePreference: applicationData.ratePreference!,
          fixedYears: applicationData.fixedYears,
          employmentStatus: applicationData.employmentStatus,
          employmentStartDate: applicationData.employmentStartDate,
          grossAnnualSalary: applicationData.grossAnnualSalary,
          relationshipStatus: applicationData.relationshipStatus,
          partnerEmploymentStatus: applicationData.partnerEmploymentStatus,
          partnerEmploymentStartDate: applicationData.partnerEmploymentStartDate,
          partnerGrossSalary: applicationData.partnerGrossSalary,
          dependents: applicationData.dependents,
          hasExistingLoans: applicationData.hasExistingLoans,
          existingLoanLender: applicationData.hasExistingLoans
            ? applicationData.existingLoanLender === 'Other' ? applicationData.existingLoanLenderOther : applicationData.existingLoanLender
            : undefined,
          existingLoanInterestRate: applicationData.hasExistingLoans ? applicationData.existingLoanInterestRate : undefined,
          existingLoanBalance: applicationData.hasExistingLoans ? applicationData.existingLoanBalance : undefined,
          hasCreditCard: applicationData.hasCreditCard,
          creditCardLimit: applicationData.creditCardLimit,
          currentStage: 'LEAD_CAPTURED',
        }
      });
      
      const notification = await enqueueAdminNotification(tx, { key: `application.created:${application.id}`, type: 'APPLICATION_CREATED', applicationId: application.id });
      return { applicationId: application.id, userId: profile.id, notificationEventId: notification.id };
    }, { timeout: 15_000 });
    after(() => tryAdminNotifications(notificationEventId));

    //Logging
    console.log(`[Create API] Application ${createdApplicationId} created. Triggering Engine...`);
    // Trigger recommendation service after application creation
    let recommendationResult = null;
    let recommendationStatus: 'COMPLETED' | 'PENDING' = 'COMPLETED';
    try {
      recommendationResult = await generateRecommendations({
        applicationId: createdApplicationId,
        userId: createdApplicationOwnerId,
      });
      console.log(`[Create API] Engine finished. Generated ${recommendationResult.count} quotes.`);
    } catch (recommendationError) {
      // The application transaction has already committed. Do not report a
      // saved application as failed just because recommendations need retry.
      recommendationStatus = 'PENDING';
      console.error('[Create API] Application saved; recommendation generation failed:', recommendationError);
    }

    // Return the application ID and recommendation results
    return NextResponse.json({ 
      success: true, 
      applicationId: createdApplicationId,
      recommendationStatus,
      recommendation: recommendationResult,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error(`[Create API] Failed to process application (${requestId}):`, error);

    if (error instanceof ApplicationProfileError) {
      return NextResponse.json({ error: error.message, diagnostic: { code: error.code, stage: 'profile', requestId } }, { status: error.status });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json({
        error: 'Your application could not be saved due to a server configuration issue. Please try again after the server has been updated. Your questionnaire answers have been retained.',
        diagnostic: { code: 'APPLICATION_DATABASE_CLIENT_VALIDATION_FAILED', stage: 'database_client', requestId },
      }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Could not save your application. Please retry; your questionnaire details are still available in this browser.', diagnostic: { code: 'APPLICATION_SAVE_FAILED', stage: 'database_transaction', requestId, ...(error instanceof Prisma.PrismaClientKnownRequestError ? { databaseCode: error.code } : {}) } },
      { status: 500 }
    );
  }
}
