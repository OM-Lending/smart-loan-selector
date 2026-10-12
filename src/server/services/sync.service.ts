import 'server-only';
import * as crypto from 'crypto';
import { Decimal } from 'decimal.js';
import { prisma } from '@/server/lib/prisma';
import { fetchCDR, delay } from '@/server/lib/cdr-client';

const TARGET_BANKS = [
  'Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ', 'CommBank', 
  'Macquarie', 'ING', 'Bendigo', 'Bank of Queensland', 'BOQ',
  'Bankwest', 'St.George', 'St George', 'Citi', 'AMP', 'Qudos', 'Bank of China', 'BOC',
  'La Trobe', 'Pepper', 'Think Tank', 'Brighten'
];

const BIG_4_NAMES = ['Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ', 'CommBank'];

function normalizeRate(value: unknown): string {
  const rate = new Decimal(String(value));
  if (!rate.greaterThan(0) || !rate.lessThan(100)) throw new Error("Invalid interest rate");
  return rate.toFixed(4); 
}

function generateRateHash(input: { rateType: string; repaymentType: string; loanPurpose: string; interestRate: string }) {
  const canonical = [input.rateType, input.repaymentType, input.loanPurpose, input.interestRate].join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export async function syncCdrProductsService() {
  const syncStartTime = new Date();
  const summaryData = await fetchCDR('https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary', { 'x-v': '1' });
  if (!summaryData?.data) throw new Error('Failed to fetch CDR brands');

  let totalUpdated = 0;

  // Filter brands to only those in TARGET_BANKS
  const targetBrands = summaryData.data.filter((brand: any) => 
    TARGET_BANKS.some(target => brand.brandName.toLowerCase().includes(target.toLowerCase()))
  );

  for (const brand of targetBrands) {
    if (!brand.publicBaseUri) continue;

    // Check the Big 4 banks or not
    const isBig4 = BIG_4_NAMES.some(b4 => brand.brandName.toLowerCase().includes(b4.toLowerCase()));

    const dbLender = await prisma.lender.upsert({
      where: { name: brand.brandName },
      update: { logoUrl: brand.logoUri, isActive: true, category: isBig4 ? 'BIG_4' : 'NON_BANK', tier: isBig4 ? 1 : 2 },
      create: { name: brand.brandName, category: isBig4 ? 'BIG_4' : 'NON_BANK', tier: isBig4 ? 1 : 2 }
    });

    const syncRun = await prisma.lenderSyncRun.create({
      data: { lenderId: dbLender.id, status: 'IN_PROGRESS', startedAt: syncStartTime }
    });

    let errorCount = 0;
    let stats = { 
      productsSeen: 0, productsAdded: 0, productsDisabled: 0, 
      ratesSeen: 0, ratesAdded: 0, ratesChanged: 0, ratesDisabled: 0 
    };

    try {
      const productsList = await fetchCDR(`${brand.publicBaseUri}/cds-au/v1/banking/products`, { 'x-v': '100', 'x-min-v': '1' });
      const mortgages = (productsList?.data?.products || []).filter((p: any) => p.productCategory === 'RESIDENTIAL_MORTGAGES');

      const seenProductIds: string[] = [];

      for (const product of mortgages) {
        stats.productsSeen++;
        try {
          await delay(300);
          const detailsData = await fetchCDR(`${brand.publicBaseUri}/cds-au/v1/banking/products/${product.productId}`, { 'x-v': '100', 'x-min-v': '1' });
          const details = detailsData?.data;
          if (!details) continue;

          const existingProduct = await prisma.loanProduct.findUnique({ where: { lenderId_externalId: { lenderId: dbLender.id, externalId: details.productId } } });
          if (!existingProduct) stats.productsAdded++;

          const dbProduct = await prisma.loanProduct.upsert({
            where: { lenderId_externalId: { lenderId: dbLender.id, externalId: details.productId } },
            update: { productName: details.name, isActive: true },
            create: { lenderId: dbLender.id, externalId: details.productId, productName: details.name }
          });
          seenProductIds.push(dbProduct.id);

          const validRates = (details.lendingRates || []).filter((r: any) => r.rate && r.lendingRateType);
          
          for (const r of validRates) {
            stats.ratesSeen++;
            const normalizedRateStr = normalizeRate(r.rate);
            const currentHash = generateRateHash({
              rateType: r.lendingRateType, repaymentType: r.repaymentType, loanPurpose: r.loanPurpose, interestRate: normalizedRateStr
            });
            
            const existingRate = await prisma.loanRate.findUnique({
              where: { productId_rateType_repaymentType_loanPurpose: { productId: dbProduct.id, rateType: r.lendingRateType, repaymentType: r.repaymentType, loanPurpose: r.loanPurpose } }
            });

            const needsHistoryUpdate = !existingRate || 
              generateRateHash({
                rateType: existingRate.rateType, repaymentType: existingRate.repaymentType, loanPurpose: existingRate.loanPurpose, interestRate: (existingRate.interestRate as any).toFixed(4)
              }) !== currentHash;

            if (!existingRate) stats.ratesAdded++;
            else if (needsHistoryUpdate) stats.ratesChanged++;

            await prisma.$transaction(async (tx) => {
              await tx.loanRate.upsert({
                where: { productId_rateType_repaymentType_loanPurpose: { productId: dbProduct.id, rateType: r.lendingRateType, repaymentType: r.repaymentType, loanPurpose: r.loanPurpose } },
                update: { interestRate: normalizedRateStr, isActive: true, lastObservedAt: syncStartTime, lastSyncRunId: syncRun.id },
                create: { productId: dbProduct.id, rateType: r.lendingRateType, repaymentType: r.repaymentType, loanPurpose: r.loanPurpose, interestRate: normalizedRateStr, isActive: true, lastObservedAt: syncStartTime, lastSyncRunId: syncRun.id }
              });

              if (needsHistoryUpdate) {
                await tx.loanRateHistory.create({
                  data: {
                    productId: dbProduct.id, syncRunId: syncRun.id, rateType: r.lendingRateType, repaymentType: r.repaymentType, loanPurpose: r.loanPurpose, interestRate: normalizedRateStr, contentHash: currentHash,
                    effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : null,
                    effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
                    sourceUpdatedAt: details.lastUpdated ? new Date(details.lastUpdated) : null
                  }
                });
              }
            });
          }
          
          const disabledRates = await prisma.loanRate.updateMany({
             where: { productId: dbProduct.id, lastObservedAt: { lt: syncStartTime }, isActive: true },
             data: { isActive: false }
          });
          stats.ratesDisabled += disabledRates.count;

        } catch (err) {
          errorCount++;
          console.error(`Failed to sync product ${product.productId}`, err);
        }
      }

      const disabledProducts = await prisma.loanProduct.updateMany({
        where: { lenderId: dbLender.id, id: { notIn: seenProductIds }, isActive: true },
        data: { isActive: false }
      });
      stats.productsDisabled += disabledProducts.count;

      const finalStatus = errorCount > 0 ? (stats.productsSeen > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCESS';

      await prisma.lenderSyncRun.update({
        where: { id: syncRun.id },
        data: { status: finalStatus, completedAt: new Date(), ...stats }
      });

    } catch (error: any) {
      await prisma.lenderSyncRun.update({
        where: { id: syncRun.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: error.message, ...stats }
      });
    }
  }
  
  return totalUpdated;
}