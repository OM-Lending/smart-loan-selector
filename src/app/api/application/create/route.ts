import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ApplicationSchema } from '@/lib/validations/application';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing session' }, 
        { status: 401 }
      );
    }

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
    
    // Extract profile-specific fields
    const { firstName, lastName, email, phone, ...applicationData } = validData;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    await prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { id: user.id },
        update: {
          phone: phone,
          fullName: fullName || undefined,
          email: email || undefined,
        },
        create: {
          id: user.id,
          phone: phone,
          email: email || `${user.id}@pending.com`,
          fullName: fullName,
          role: 'CUSTOMER',
        }
      });

      await tx.application.create({
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
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to process application:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}