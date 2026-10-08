import 'server-only';

import { prisma } from '@/server/lib/prisma';
import { fetchCDR, delay } from '@/server/lib/cdr-client';

const TARGET_BANKS = [
  'Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ', 'CommBank', 'Macquarie Bank',
  'ING BANK (Australia) Ltd', 'Bendigo Bank', 'Bank of Queensland', 'Suncorp Bank',
  'Bankwest', 'St.George Bank', 'Citi', 'AMP', 'Qudos Bank', 'Bank of China',
  'La Trobe', 'Pepper', 'Think Tank', 'Brighten'
];

// Helper for Tier & Category mapping
const BIG_4_NAMES = ['Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ', 'CommBank'];

export async function syncCdrProductsService() {
  console.log('[SYNC] Starting CDR banking data synchronization...');
  
  const summaryData = await fetchCDR('https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary', {
    'x-v': '1'
  });

  if (!summaryData?.data) {
    throw new Error('Failed to fetch CDR brands summary.');
  }

  const targetBrands = summaryData.data.filter((brand: any) => 
    TARGET_BANKS.some(target => brand.brandName.toLowerCase().includes(target.toLowerCase()))
  );

  let totalProductsSynced = 0;

  for (const brand of targetBrands) {
    const publicBaseUri = brand.publicBaseUri;
    const brandName = brand.brandName;
    if (!publicBaseUri) continue;

    console.log(`[SYNC] Processing Lender: ${brandName}...`);

    // 1. Check if the lender exists in the database; if not, create it
    const isBig4 = BIG_4_NAMES.includes(brandName);
    const dbLender = await prisma.lender.upsert({
      where: { name: brandName },
      update: {
        logoUrl: brand.logoUri || null,
      },
      create: {
        name: brandName,
        logoUrl: brand.logoUri || null,
        category: isBig4 ? 'BIG_4' : 'NON_BANK',
        tier: isBig4 ? 1 : 2,
      }
    });

    const productsList = await fetchCDR(`${publicBaseUri}/cds-au/v1/banking/products`, { 'x-v': '100', 'x-min-v': '1' });
    if (!productsList?.data?.products) continue;

    const mortgageProducts = productsList.data.products.filter(
      (p: any) => p.productCategory === 'RESIDENTIAL_MORTGAGES'
    );

    for (const product of mortgageProducts) {
      await delay(500); 

      const detailsData = await fetchCDR(`${publicBaseUri}/cds-au/v1/banking/products/${product.productId}`, { 'x-v': '100', 'x-min-v': '1' });
      if (!detailsData?.data) continue;
      
      const details = detailsData.data;
      let maxLvr = null;
      let minLimit = null;
      
      if (Array.isArray(details.constraints)) {
        const lvrConstraint = details.constraints.find((c: any) => c.constraintType === 'MAX_LVR');
        if (lvrConstraint?.additionalValue) maxLvr = parseFloat(lvrConstraint.additionalValue);

        const limitConstraint = details.constraints.find((c: any) => c.constraintType === 'MIN_LIMIT');
        if (limitConstraint?.additionalValue) minLimit = parseFloat(limitConstraint.additionalValue);
      }

      const validRates = (details.lendingRates || []).filter(
        (r: any) => r.rate && r.repaymentType && r.loanPurpose && r.lendingRateType
      );

      if (validRates.length === 0) continue;

      // 2. Upsert product and associated rates to lender
      await prisma.$transaction(async (tx) => {
        const dbProduct = await tx.loanProduct.upsert({
          where: {
            lenderId_externalId: {
              lenderId: dbLender.id,
              externalId: details.productId
            }
          },
          update: {
            productName: details.name,
            description: details.description,
            maxLvr: maxLvr,
            minLimit: minLimit,
            isActive: true
          },
          create: {
            lenderId: dbLender.id,
            externalId: details.productId,
            productName: details.name,
            description: details.description,
            maxLvr: maxLvr,
            minLimit: minLimit,
            isActive: true
          }
        });

        await tx.loanRate.deleteMany({ where: { productId: dbProduct.id } });

        await tx.loanRate.createMany({
          data: validRates.map((r: any) => ({
            productId: dbProduct.id,
            rateType: r.lendingRateType,
            repaymentType: r.repaymentType,
            loanPurpose: r.loanPurpose,
            interestRate: parseFloat(r.rate)
          }))
        });
      });

      totalProductsSynced++;
    }
  }

  return totalProductsSynced;
}