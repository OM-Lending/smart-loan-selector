import 'server-only';
import { prisma } from '@/server/lib/prisma';
import { fetchCDR, delay } from '@/server/lib/cdr-client';
import { asCdrArray, asCdrObject, contentHash, normalizeCdrProduct, type CdrObject } from '@/server/services/cdr/cdr-normalizer';
import { validateNormalizedProduct } from '@/server/services/cdr/cdr-validation';
import { reconcilePromotionSourceSnapshots } from '@/server/services/promotions/promotion-source.service';

const TARGET_BANKS = [
  'Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ', 'CommBank', 'Commonwealth Bank', 'Macquarie', 'ING',
  'Bendigo', 'Bank of Queensland', 'BOQ', 'Bankwest', 'St.George', 'St George',
  'Citi', 'AMP', 'Qudos', 'Bank of China', 'BOC', 'La Trobe', 'Pepper', 'Think Tank', 'Brighten'
];
const BIG_4_NAMES = ['Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ', 'CommBank', 'Commonwealth Bank'];
async function fetchAllProductSummaries(baseUri: string): Promise<CdrObject[]> {
  let nextUrl: string | null = new URL('/cds-au/v1/banking/products', baseUri).toString();
  const seenUrls = new Set<string>();
  const products: CdrObject[] = [];
  while (nextUrl) {
    if (seenUrls.has(nextUrl)) throw new Error('CDR product pagination loop detected');
    if (seenUrls.size >= 100) throw new Error('CDR product pagination exceeded 100 pages');
    seenUrls.add(nextUrl);
    const response = asCdrObject(await fetchCDR(nextUrl, { 'x-v': '100', 'x-min-v': '1' }));
    const data = asCdrObject(response.data);
    if (!Array.isArray(data.products)) throw new Error(`CDR product page ${seenUrls.size} was incomplete`);
    products.push(...asCdrArray(data.products));
    const link = asCdrObject(response.links).next;
    nextUrl = typeof link === 'string' && link.length > 0 ? new URL(link, nextUrl).toString() : null;
  }
  return products;
}

export async function syncCdrProductsService() {
  const summaryData = await fetchCDR('https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary', { 'x-v': '1' });
  if (!summaryData?.data) throw new Error('Failed to fetch CDR brands');
  const targetBrands = asCdrArray(summaryData.data).filter(brand => typeof brand.brandName === 'string' && TARGET_BANKS.some(target => (brand.brandName as string).toLowerCase().includes(target.toLowerCase())));
  let totalUpdated = 0;

  for (const brand of targetBrands) {
    if (typeof brand.publicBaseUri !== 'string' || typeof brand.brandName !== 'string') continue;
    const brandName = brand.brandName;
    const publicBaseUri = brand.publicBaseUri;
    const isBig4 = BIG_4_NAMES.some(name => brandName.toLowerCase().includes(name.toLowerCase()));
    const lender = await prisma.lender.upsert({
      where: { name: brandName },
      update: { logoUrl: typeof brand.logoUri === 'string' ? brand.logoUri : null, isActive: true, category: isBig4 ? 'BIG_4' : 'NON_BANK', tier: isBig4 ? 1 : 2 },
      create: { name: brandName, logoUrl: typeof brand.logoUri === 'string' ? brand.logoUri : null, category: isBig4 ? 'BIG_4' : 'NON_BANK', tier: isBig4 ? 1 : 2 },
    });
    const run = await prisma.lenderSyncRun.create({ data: { lenderId: lender.id, status: 'IN_PROGRESS' } });
    const stats = { productsSeen: 0, productsAdded: 0, productsDisabled: 0, ratesSeen: 0, ratesAdded: 0, ratesChanged: 0, ratesDisabled: 0 };
    let errors = 0;
    let complete = false;
    try {
      const products = (await fetchAllProductSummaries(publicBaseUri)).filter(p => p.productCategory === 'RESIDENTIAL_MORTGAGES');
      const seenProductIds: string[] = [];

      for (const listed of products) {
        stats.productsSeen++;
        try {
          await delay(250);
          const listedProductId = typeof listed.productId === 'string' ? listed.productId : '';
          if (!listedProductId) throw new Error('Product list entry has no productId');
          const detailUrl = new URL(`/cds-au/v1/banking/products/${encodeURIComponent(listedProductId)}`, publicBaseUri).toString();
          const response = asCdrObject(await fetchCDR(detailUrl, { 'x-v': '100', 'x-min-v': '1' }));
          const rawProduct = asCdrObject(response.data);
          const normalizedProduct = normalizeCdrProduct(rawProduct);
          const validation = validateNormalizedProduct(normalizedProduct);
          if (validation.errors.length) throw new Error(validation.errors.join('; '));
          if (validation.warnings.length) {
            errors++;
            console.warn(`Partial CDR normalization for ${listedProductId}:`, validation.warnings);
          }
          const productId = normalizedProduct.externalId;
          const productName = normalizedProduct.productName || (typeof listed.name === 'string' ? listed.name : productId);
          const existing = await prisma.loanProduct.findUnique({ where: { lenderId_externalId: { lenderId: lender.id, externalId: productId } } });
          if (!existing) stats.productsAdded++;
          const productData = await prisma.loanProduct.upsert({
            where: { lenderId_externalId: { lenderId: lender.id, externalId: productId } },
            update: {
              productName, description: normalizedProduct.description, features: normalizedProduct.features,
              rawPayload: normalizedProduct.rawPayload, maxLvr: normalizedProduct.maxLvr, minLimit: normalizedProduct.minLimit,
              parseStatus: validation.warnings.length ? 'PARTIALLY_PARSED' : normalizedProduct.parseStatus, isActive: true,
            },
            create: {
              lenderId: lender.id, externalId: productId, productName,
              description: normalizedProduct.description, features: normalizedProduct.features, rawPayload: normalizedProduct.rawPayload,
              maxLvr: normalizedProduct.maxLvr, minLimit: normalizedProduct.minLimit,
              parseStatus: validation.warnings.length ? 'PARTIALLY_PARSED' : normalizedProduct.parseStatus,
            },
          });
          seenProductIds.push(productData.id);

          const productHash = contentHash(normalizedProduct.rawPayload);
          const snapshotExists = await prisma.loanProductSnapshot.findUnique({ where: { productId_contentHash: { productId: productData.id, contentHash: productHash } }, select: { id: true } });
          if (!snapshotExists) await prisma.loanProductSnapshot.create({ data: {
            productId: productData.id, syncRunId: run.id, contentHash: productHash, rawPayload: normalizedProduct.rawPayload,
          } });

          // An omitted optional CDR field is not proof that an offer was
          // withdrawn. Only reconcile removals when the complete features
          // array is explicitly present in the response.
          if (Array.isArray(rawProduct.features)) {
            await prisma.$transaction(tx => reconcilePromotionSourceSnapshots(
              tx,
              productData.id,
              asCdrArray(rawProduct.features),
            ));
          }

          await prisma.$transaction(async tx => {
            await tx.loanProductConstraint.deleteMany({ where: { productId: productData.id } });
            if (normalizedProduct.constraints.length) await tx.loanProductConstraint.createMany({ data: normalizedProduct.constraints.map(c => ({ ...c, productId: productData.id })) });
            await tx.loanProductFee.deleteMany({ where: { productId: productData.id } });
            if (normalizedProduct.fees.length) await tx.loanProductFee.createMany({ data: normalizedProduct.fees.map(f => ({ ...f, productId: productData.id })) });

            const observedIds: string[] = [];
            for (const rate of normalizedProduct.rates) {
              stats.ratesSeen++;
              const prev = await tx.loanRate.findUnique({ where: { productId_conditionHash: { productId: productData.id, conditionHash: rate.conditionHash } } });
              const changed = !prev || contentHash({ rate: prev.interestRate.toFixed(4), minAmount: prev.minAmount?.toFixed(2), maxAmount: prev.maxAmount?.toFixed(2), minLvr: prev.minLvr?.toFixed(2), maxLvr: prev.maxLvr?.toFixed(2), conditions: prev.rateConditions }) !== contentHash({ rate: rate.interestRate, minAmount: rate.minAmount, maxAmount: rate.maxAmount, minLvr: rate.minLvr, maxLvr: rate.maxLvr, conditions: rate.rateConditions });
              if (!prev) stats.ratesAdded++;
              else if (changed) stats.ratesChanged++;
              const saved = await tx.loanRate.upsert({
                where: { productId_conditionHash: { productId: productData.id, conditionHash: rate.conditionHash } },
                update: { ...rate, isActive: true, lastObservedAt: new Date(), lastSyncRunId: run.id },
                create: { productId: productData.id, ...rate, lastObservedAt: new Date(), lastSyncRunId: run.id },
              });
              observedIds.push(saved.id);
              if (changed) await tx.loanRateHistory.create({ data: {
                productId: productData.id, syncRunId: run.id, rateType: rate.rateType, repaymentType: rate.repaymentType,
                loanPurpose: rate.loanPurpose, interestRate: rate.interestRate,
                contentHash: contentHash({ conditionHash: rate.conditionHash, interestRate: rate.interestRate }),
              } });
            }
            if (validation.ratesSafeToReconcile) {
              const deactivated = await tx.loanRate.updateMany({ where: { productId: productData.id, isActive: true, id: { notIn: observedIds } }, data: { isActive: false } });
              stats.ratesDisabled += deactivated.count;
            }
          });
          totalUpdated++;
        } catch (error: unknown) {
          errors++;
          console.error(`Failed to sync product ${listed.productId}`, error);
        }
      }
      complete = errors === 0;
      // Do not deactivate absent products after any partial/failed detail response.
      if (complete) {
        const deactivated = await prisma.loanProduct.updateMany({ where: { lenderId: lender.id, isActive: true, id: { notIn: seenProductIds } }, data: { isActive: false } });
        stats.productsDisabled = deactivated.count;
      }
      await prisma.lenderSyncRun.update({ where: { id: run.id }, data: {
        status: complete ? 'SUCCESS' : 'PARTIAL', completedAt: new Date(),
        errorMessage: errors ? `${errors} product(s) had incomplete data or failed detail retrieval; missing-product deactivation skipped.` : null, ...stats,
      } });
    } catch (error: unknown) {
      await prisma.lenderSyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: error instanceof Error ? error.message : String(error), ...stats } });
    }
  }
  return totalUpdated;
}
