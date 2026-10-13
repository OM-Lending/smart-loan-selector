import 'server-only';
import { PromotionReviewStatus, Prisma } from '@prisma/client';
import { contentHash, toJson, type CdrObject } from '@/server/services/cdr/cdr-normalizer';

export type PromotionSourceCandidate = {
  sourceKey: string;
  sourceHash: string;
  sourceFeature: Prisma.InputJsonValue;
  suggestedAmount: string | null;
  amountParseStatus: 'PARSED' | 'UNPARSED';
};

function parseSuggestedAmount(feature: CdrObject): string | null {
  const value = feature.additionalValue;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value.toFixed(2);
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/[,$\s]/g, '');
    if (/^\d+(?:\.\d{1,2})?$/.test(normalized) && Number(normalized) > 0) return Number(normalized).toFixed(2);
  }
  const text = [feature.additionalInfo, feature.description].filter(item => typeof item === 'string').join(' ');
  const amounts = [...text.matchAll(/(?:AUD\s*|\$\s*)(\d[\d,]*(?:\.\d{1,2})?)/gi)]
    .map(match => Number(match[1].replace(/,/g, '')))
    .filter(amount => Number.isFinite(amount) && amount > 0);
  const uniqueAmounts = [...new Set(amounts)];
  return uniqueAmounts.length === 1 ? uniqueAmounts[0].toFixed(2) : null;
}

function normalizeText(value: unknown): unknown {
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ');
  if (Array.isArray(value)) return value.map(normalizeText);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizeText(item)]));
  }
  return value;
}

function normalizedUri(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const uri = new URL(value);
    for (const key of [...uri.searchParams.keys()]) {
      if (key.toLowerCase() === 'cid' || key.toLowerCase().startsWith('utm_')) uri.searchParams.delete(key);
    }
    uri.hash = '';
    return uri.toString().replace(/\/$/, '');
  } catch {
    return value.trim();
  }
}

/**
 * CDR offer text is not uniform across data holders. Prefer the standard
 * featureType, while also flagging likely cashback text as a review candidate.
 * This only discovers changes; it never publishes or interprets eligibility.
 */
export function findPromotionSourceCandidates(features: CdrObject[]): PromotionSourceCandidate[] {
  const candidates: PromotionSourceCandidate[] = [];
  features.forEach((feature, index) => {
    const featureType = String(feature.featureType ?? '').trim().toUpperCase();
    const text = [feature.additionalInfo, feature.description, feature.additionalValue]
      .filter(value => typeof value === 'string').join(' ');
    const looksLikeCashback = /cash\s*back|cashback|rebate|cash\s+bonus|first[- ]home[- ]buyer.{0,40}bonus/i.test(text);
    if (featureType !== 'CASHBACK_OFFER' && !looksLikeCashback) return;

    const sourceUri = normalizedUri(feature.additionalInfoUri);
    const normalizedType = featureType || 'CASHBACK_TEXT_CANDIDATE';
    // An offer URI is a relatively stable identity. For text-only offers, use
    // the feature's array position as a fallback, while the hash detects edits.
    const sourceKey = `${normalizedType}:${sourceUri ?? `index-${index}`}`;
    const hashFields = {
      ...feature,
      featureType: normalizedType,
      additionalInfoUri: sourceUri,
    };
    candidates.push({
      sourceKey,
      sourceHash: contentHash(normalizeText(hashFields)),
      sourceFeature: toJson(feature),
      suggestedAmount: parseSuggestedAmount(feature),
      amountParseStatus: parseSuggestedAmount(feature) ? 'PARSED' : 'UNPARSED',
    });
  });
  return candidates;
}

/** Persist source revisions and review notifications for one fully fetched product. */
export async function reconcilePromotionSourceSnapshots(
  tx: Prisma.TransactionClient,
  productId: string,
  features: CdrObject[],
  observedAt = new Date(),
) {
  const candidates = findPromotionSourceCandidates(features);
  const currentRows = await tx.promotionSourceSnapshot.findMany({ where: { productId, isCurrent: true } });
  const currentByKey = new Map(currentRows.map(row => [row.sourceKey, row]));
  const seenKeys = new Set<string>();

  for (const candidate of candidates) {
    seenKeys.add(candidate.sourceKey);
    const existingRevision = await tx.promotionSourceSnapshot.findUnique({
      where: { productId_sourceKey_sourceHash: { productId, sourceKey: candidate.sourceKey, sourceHash: candidate.sourceHash } },
    });
    const previous = currentByKey.get(candidate.sourceKey);

    if (previous?.sourceHash === candidate.sourceHash) {
      await tx.promotionSourceSnapshot.update({ where: { id: previous.id }, data: { lastObservedAt: observedAt } });
      continue;
    }

    if (previous) await tx.promotionSourceSnapshot.update({ where: { id: previous.id }, data: { isCurrent: false } });
    const changeType = previous ? 'UPDATED' : 'DISCOVERED';
    if (existingRevision) {
      await tx.promotionSourceSnapshot.update({
        where: { id: existingRevision.id },
        data: {
          sourceFeature: candidate.sourceFeature,
          suggestedAmount: candidate.suggestedAmount,
          amountParseStatus: candidate.amountParseStatus,
          changeType,
          reviewStatus: PromotionReviewStatus.REVIEW_REQUIRED,
          isCurrent: true,
          lastObservedAt: observedAt,
          reviewedAt: null,
          reviewedBy: null,
        },
      });
    } else {
      await tx.promotionSourceSnapshot.create({ data: {
        productId,
        sourceKey: candidate.sourceKey,
        sourceHash: candidate.sourceHash,
        changeType,
        sourceFeature: candidate.sourceFeature,
        suggestedAmount: candidate.suggestedAmount,
        amountParseStatus: candidate.amountParseStatus,
        reviewStatus: PromotionReviewStatus.REVIEW_REQUIRED,
        isCurrent: true,
        firstObservedAt: observedAt,
        lastObservedAt: observedAt,
      } });
    }
  }

  // A feature disappearing from a successfully fetched full product payload is
  // also a review event; represent it as a current tombstone revision.
  for (const previous of currentRows) {
    if (seenKeys.has(previous.sourceKey)) continue;
    const sourceHash = contentHash({ removed: true, previousHash: previous.sourceHash });
    await tx.promotionSourceSnapshot.update({ where: { id: previous.id }, data: { isCurrent: false } });
    const tombstone = await tx.promotionSourceSnapshot.findUnique({
      where: { productId_sourceKey_sourceHash: { productId, sourceKey: previous.sourceKey, sourceHash } },
    });
    if (tombstone) {
      await tx.promotionSourceSnapshot.update({ where: { id: tombstone.id }, data: {
        changeType: 'REMOVED', reviewStatus: PromotionReviewStatus.REVIEW_REQUIRED,
        isCurrent: true, lastObservedAt: observedAt, reviewedAt: null, reviewedBy: null,
      } });
    } else {
      await tx.promotionSourceSnapshot.create({ data: {
        productId, sourceKey: previous.sourceKey, sourceHash, changeType: 'REMOVED',
        sourceFeature: toJson({ removed: true, previousFeature: previous.sourceFeature }),
        reviewStatus: PromotionReviewStatus.REVIEW_REQUIRED, isCurrent: true,
        firstObservedAt: observedAt, lastObservedAt: observedAt,
      } });
    }
  }
}
