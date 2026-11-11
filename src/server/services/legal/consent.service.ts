import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma, type LegalConsentPurpose, type LegalConsentSource, type LegalDocumentType } from '@prisma/client';
import { CONSENT_STATEMENTS, ConsentPayloadSchema, LEGAL_VERSION, type ConsentFlag } from '@/lib/legal/consent';
import { LEGAL_DOCUMENTS } from '@/lib/legal/documents';
import { prisma } from '@/server/lib/prisma';

type Database = Pick<Prisma.TransactionClient, 'legalConsentRecord' | 'legalDocumentVersion'>;
export class LegalConsentError extends Error {
  constructor(message = 'Please review the legal notices and select the required confirmation before continuing.', public code = 'LEGAL_CONSENT_REQUIRED') { super(message); }
}
export function readConsentPayload(value: unknown) {
  const parsed = ConsentPayloadSchema.safeParse(value);
  if (!parsed.success) throw new LegalConsentError('Please review the current legal notices and confirm before continuing. Refresh the page if the notices have changed.', 'LEGAL_CONSENT_VERSION_REQUIRED');
  return parsed.data;
}
export function requireConsent(value: ReturnType<typeof readConsentPayload>, flag: ConsentFlag) {
  if (value[flag] !== true) throw new LegalConsentError();
}
const documentsForPurpose = (purpose: LegalConsentPurpose): LegalDocumentType[] => purpose === 'TERMS_ACCEPTANCE' ? ['TERMS'] : ['PRIVACY', 'COLLECTION_NOTICE'];

export async function hasCurrentConsent(clerkUserId: string, purpose: LegalConsentPurpose, applicationId?: string, database: Database = prisma): Promise<boolean> {
  const expected = documentsForPurpose(purpose);
  const rows = await database.legalConsentRecord.findMany({
    where: { clerkUserId, purpose, applicationId: applicationId ?? null, documentVersion: { version: LEGAL_VERSION, type: { in: expected } } },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], select: { action: true, documentVersion: { select: { type: true } } },
  });
  return expected.every(type => rows.find(row => row.documentVersion.type === type)?.action === 'GRANTED');
}

type RecordInput = { purpose: LegalConsentPurpose; flag: ConsentFlag; source: LegalConsentSource; profileId?: string; clerkUserId?: string; applicationId?: string; enquiryId?: string; eventKey: string };
export async function recordLegalConsents(tx: Prisma.TransactionClient, inputs: RecordInput[]) {
  if (!inputs.length) return;
  const documents = LEGAL_DOCUMENTS.map(document => {
    const content = { document, consentStatements: CONSENT_STATEMENTS };
    return { type: document.key, version: document.version, title: document.title, path: document.path, content: content as unknown as Prisma.InputJsonValue, contentHash: createHash('sha256').update(JSON.stringify(content)).digest('hex'), publishedAt: new Date('2026-11-11T00:00:00.000Z') };
  });
  let versions = await tx.legalDocumentVersion.findMany({ where: { version: LEGAL_VERSION } });
  const missing = documents.filter(document => !versions.some(row => row.type === document.type));
  if (missing.length) {
    await tx.legalDocumentVersion.createMany({ data: missing, skipDuplicates: true });
    versions = await tx.legalDocumentVersion.findMany({ where: { version: LEGAL_VERSION } });
  }
  for (const document of documents) {
    if (versions.find(row => row.type === document.type)?.contentHash !== document.contentHash) throw new LegalConsentError('The legal notice version needs an update. Please contact support.', 'LEGAL_DOCUMENT_VERSION_CONFLICT');
  }
  // A later grant must remain possible after a recorded withdrawal. Keep the
  // new acceptance separate while making retries of that acceptance idempotent.
  const withdrawals = await tx.legalConsentRecord.findMany({
    where: { action: 'WITHDRAWN', documentVersion: { version: LEGAL_VERSION }, OR: inputs.map(input => ({ purpose: input.purpose, clerkUserId: input.clerkUserId ?? null, applicationId: input.applicationId ?? null, enquiryId: input.enquiryId ?? null })) },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], select: { id: true, purpose: true, clerkUserId: true, applicationId: true, enquiryId: true, documentVersionId: true },
  });
  await tx.legalConsentRecord.createMany({ data: inputs.flatMap(input => documentsForPurpose(input.purpose).map(type => ({
    recordKey: createHash('sha256').update(JSON.stringify([input.eventKey, input.purpose, type, LEGAL_VERSION, input.clerkUserId ?? null, withdrawals.find(row => row.purpose === input.purpose && row.clerkUserId === (input.clerkUserId ?? null) && row.applicationId === (input.applicationId ?? null) && row.enquiryId === (input.enquiryId ?? null) && row.documentVersionId === versions.find(version => version.type === type)!.id)?.id ?? null])).digest('hex'),
    purpose: input.purpose, source: input.source, action: 'GRANTED' as const,
    documentVersionId: versions.find(row => row.type === type)!.id,
    profileId: input.profileId, clerkUserId: input.clerkUserId, applicationId: input.applicationId, enquiryId: input.enquiryId,
    statement: CONSENT_STATEMENTS[input.flag],
  }))), skipDuplicates: true });
}
