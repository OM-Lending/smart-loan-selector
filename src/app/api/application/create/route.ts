import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { randomUUID } from 'node:crypto';
import { ContactDetailsSchema, LoanApplicationSchema, type ContactDetails } from '@/lib/validations/application';
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
    const validationResult = LoanApplicationSchema.safeParse(body);

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
    const { applicationId: createdApplicationId, userId: createdApplicationOwnerId } = await prisma.$transaction(async (tx) => {
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
          currentLender: applicationData.currentLender,
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
          existingMonthlyRepayment: applicationData.existingMonthlyRepayment,
          hasCreditCard: applicationData.hasCreditCard,
          creditCardLimit: applicationData.creditCardLimit,
          currentStage: 'LEAD_CAPTURED',
        }
      });
      
      return { applicationId: application.id, userId: profile.id };
    });

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

    return NextResponse.json(
      { error: 'Could not save your application. Please retry; your questionnaire details are still available in this browser.', diagnostic: { code: 'APPLICATION_SAVE_FAILED', stage: 'database_transaction', requestId } },
      { status: 500 }
    );
  }
}
