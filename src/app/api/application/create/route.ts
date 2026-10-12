import { NextResponse } from 'next/server';
import { createClient } from '@/server/lib/supabase';
import { prisma } from '@/server/lib/prisma';
import { ApplicationSchema } from '@/lib/validations/application';
import { 
  generateRecommendations, 
  NotFoundError, 
  ValidationError 
} from '@/server/services/recommendation.service';

export async function POST(request: Request) {
  try {
    // Authenticate user session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing session' }, 
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
    
    // Extract profile-specific fields for upsert
    const { firstName, lastName, email, phone, ...applicationData } = validData as any;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // Get the application ID
    const createdApplicationId = await prisma.$transaction(async (tx) => {
      // 1. Update or create user profile
      await tx.profile.upsert({
        where: { id: user.id },
        update: {
          phone: phone || user.phone,
          fullName: fullName || undefined,
          email: email || undefined,
        },
        create: {
          id: user.id,
          phone: phone || user.phone,
          email: email || `${user.id}@pending.com`, // Fallback for SMS-only signups
          fullName: fullName,
          role: 'CUSTOMER',
        }
      });

      // 2. Persist loan application data
      const application = await tx.application.create({
        data: {
          userId: user.id,
          goal: applicationData.goal,
          buySituation: applicationData.buySituation,
          isFirstHomeBuyer: applicationData.isFirstHomeBuyer,
          propertyUse: applicationData.propertyUse,
          propertyStatus: applicationData.propertyStatus,
          propertyType: applicationData.propertyType,
          propertyPostcode: applicationData.propertyPostcode,
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
      
      return application.id;
    });

    //Logging
    console.log(`[Create API] Application ${createdApplicationId} created. Triggering Engine...`);
    // Trigger recommendation service after application creation
    const recommendationResult = await generateRecommendations({ 
      applicationId: createdApplicationId, 
      userId: user.id 
    });
    // Logging
    console.log(`[Create API] Engine finished. Generated ${recommendationResult.count} quotes.`);

    // Return the application ID and recommendation results
    return NextResponse.json({ 
      success: true, 
      applicationId: createdApplicationId,
      recommendation: recommendationResult 
    });

  } catch (error: any) {
    console.error('Failed to process application:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}