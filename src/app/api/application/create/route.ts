import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { getAuthenticatedProfile } from '@/server/lib/auth';
import { randomUUID } from 'node:crypto';
import { ApplicationSchema } from '@/lib/validations/application';
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
    const validationResult = ApplicationSchema.safeParse(body);

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
    const normalizedEmail = validData.email.trim().toLowerCase();
    if (!identity.emailVerified || identity.email !== normalizedEmail) {
      return NextResponse.json(
        {
          error: 'Verify the same email address before saving your application.',
          diagnostic: {
            code: identity.emailVerified ? 'VERIFIED_EMAIL_MISMATCH' : 'EMAIL_NOT_VERIFIED',
            stage: 'email_verification',
            requestId,
          },
        },
        { status: 403 }
      );
    }
    const phone = `+61${validData.phone}`;

    // Extract profile-specific fields for upsert
    const { firstName, lastName, ...applicationData } = validData;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // Get the application ID
    const { applicationId: createdApplicationId, userId: createdApplicationOwnerId } = await prisma.$transaction(async (tx) => {
      // Keep the database's UUID profile identity stable. Clerk IDs are strings
      // and are stored only as an external identity mapping.
      let profile = await tx.profile.findUnique({ where: { clerkUserId: identity.clerkUserId } });
      if (!profile) profile = await tx.profile.findUnique({ where: { email: normalizedEmail } });
      if (profile?.clerkUserId && profile.clerkUserId !== identity.clerkUserId) {
        throw new Error('This email is already linked to another login account.');
      }
      if (profile) {
        profile = await tx.profile.update({
          where: { id: profile.id },
          data: { clerkUserId: identity.clerkUserId, phone, fullName: fullName || undefined, email: normalizedEmail },
        });
      } else {
        profile = await tx.profile.create({
          data: { id: randomUUID(), clerkUserId: identity.clerkUserId, email: normalizedEmail, phone, fullName, role: 'CUSTOMER' },
        });
      }

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

    if (error instanceof Error && error.message === 'This email is already linked to another login account.') {
      return NextResponse.json({ error: error.message }, { status: 409 });
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
