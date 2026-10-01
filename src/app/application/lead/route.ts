// src/app/application/lead/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/../lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const application = await prisma.application.create({
      data: {
        loanPurpose: body.loanPurpose,
        propertyType: body.propertyType || 'HOUSE',
        propertyPostcode: body.propertyPostcode,
        propertyValue: Number(body.propertyValue),
        loanAmount: Number(body.loanAmount),
        calculatedLvr: Number(
          Math.round((Number(body.loanAmount) / Number(body.propertyValue)) * 100)
        ),
        repaymentType: body.repaymentType,
        employmentStatus: body.employmentStatus,
        grossAnnualSalary: Number(body.grossAnnualSalary),
        maritalStatus: body.maritalStatus || 'SINGLE',
        applicantDetails: {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
        },
        currentStage: 'LEAD_CAPTURED',
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      applicationId: application.id,
    });
  } catch (error) {
    console.error('API Error saving lead application:', error);
    return NextResponse.json(
      { error: 'Failed to record application in database' },
      { status: 500 }
    );
  }
}