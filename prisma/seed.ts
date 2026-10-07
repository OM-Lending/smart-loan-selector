import { PrismaClient, LenderCategory, RatePreference, RepaymentStructure } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Initialize the Postgres adapter with your database URL
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Pass the adapter into the Prisma Client
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database with Lenders and Products...');

  // 1. Commonwealth Bank (Big 4)
  const cba = await prisma.lender.upsert({
    where: { name: 'Commonwealth Bank (CBA)' },
    update: {},
    create: {
      name: 'Commonwealth Bank (CBA)',
      tier: 1,
      category: LenderCategory.BIG_4,
      products: {
        create: [
          {
            name: 'Extra Home Loan (Variable)',
            interestRate: 6.14,
            comparisonRate: 6.15,
            rateType: RatePreference.VARIABLE,
            repaymentType: RepaymentStructure.P_AND_I,
            maxLvr: 80.00,
            minIncome: 60000.00,
          },
          {
            name: 'Wealth Package (Fixed 3 Yrs)',
            interestRate: 5.99,
            comparisonRate: 6.25,
            rateType: RatePreference.FIXED,
            repaymentType: RepaymentStructure.P_AND_I,
            maxLvr: 90.00,
            minIncome: 75000.00,
          }
        ]
      }
    }
  });

  // 2. Macquarie Bank (Non-Bank / Tier 2)
  const macquarie = await prisma.lender.upsert({
    where: { name: 'Macquarie Bank' },
    update: {},
    create: {
      name: 'Macquarie Bank',
      tier: 2,
      category: LenderCategory.NON_BANK,
      products: {
        create: [
          {
            name: 'Basic Home Loan',
            interestRate: 5.99,
            comparisonRate: 6.01,
            rateType: RatePreference.VARIABLE,
            repaymentType: RepaymentStructure.P_AND_I,
            maxLvr: 70.00, // Highly competitive for low LVR
            minIncome: 80000.00,
          },
          {
            name: 'Offset Home Loan (Investor)',
            interestRate: 6.49,
            comparisonRate: 6.55,
            rateType: RatePreference.VARIABLE,
            repaymentType: RepaymentStructure.INTEREST_ONLY,
            maxLvr: 80.00,
            minIncome: 90000.00,
          }
        ]
      }
    }
  });

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });