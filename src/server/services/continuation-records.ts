import { businessProfileData, businessProfileForResponse } from '@/server/services/self-employment-records';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { continuationDetailsSchema } from '@/lib/validations/continuation';

export const continuationRecordsInclude = {
  applicants: { orderBy: { applicantNumber: 'asc' }, include: { previousAddresses: { orderBy: { position: 'asc' } } } },
  employments: true,
  businessProfiles: { orderBy: { applicantNumber: 'asc' } },
  assets: true,
  properties: { orderBy: { position: 'asc' } },
} satisfies Prisma.ApplicationContinuationInclude;

type ContinuationWithRecords = Prisma.ApplicationContinuationGetPayload<{ include: typeof continuationRecordsInclude }>;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();
const decimal = (value: unknown) => text(value) === null ? null : new Prisma.Decimal(String(value));
const date = (value: string | null | undefined) => value ? new Date(`${value}T00:00:00.000Z`) : null;
const integer = (value: unknown) => text(value) === null ? null : Number(value);
const dateText = (value: Date | null) => value?.toISOString().slice(0, 10) ?? '';

/** Typed rows and the form snapshot always commit or roll back together. */
export async function saveContinuationRecords(tx: Prisma.TransactionClient, continuationId: string, details: Record<string, unknown>) {
  const data = continuationDetailsSchema.parse(details);
  // The form does not expose row IDs; replace its bounded child collections
  // atomically. Unique ordinals retain the displayed applicant/property order.
  await tx.continuationApplicant.deleteMany({ where: { continuationId } });
  await tx.continuationEmployment.deleteMany({ where: { continuationId } });
  await tx.continuationBusinessProfile.deleteMany({ where: { continuationId } });
  await tx.continuationProperty.deleteMany({ where: { continuationId } });
  const addresses: Prisma.ContinuationAddressCreateManyInput[] = [];
  const applicants: Prisma.ContinuationApplicantCreateManyInput[] = [];
  for (const [index, item] of [data.applicant, data.applicant2].entries()) {
    if (!item) continue;
    const applicantId = randomUUID();
    applicants.push({
      id: applicantId, continuationId, applicantNumber: index + 1,
      fullName: text(item.fullName), email: text(item.email), mobile: text(item.mobile),
      residencyStatus: item.visaStatus || null, maritalStatus: item.maritalStatus || null,
      residentialAddress: text(item.residentialAddress), residentialSince: date(item.residentialSince),
      housingArrangement: text(item.housingArrangement), dependents: integer(item.dependents),
      employmentStatus: index === 1 ? data.applicant2?.employmentStatus || null : null,
      annualIncome: index === 1 ? decimal(data.applicant2?.annualIncome) : null,
    });
    for (const [position, address] of (item.previousAddresses ?? []).entries()) addresses.push({
      applicantId, position, address: text(address.address), moveInDate: date(address.moveInDate), moveOutDate: date(address.moveOutDate),
    });
  }
  if (applicants.length) await tx.continuationApplicant.createMany({ data: applicants });
  if (addresses.length) await tx.continuationAddress.createMany({ data: addresses });
  const employments: Prisma.ContinuationEmploymentCreateManyInput[] = [];
  if (data.currentEmployment) {
    const item = data.currentEmployment;
    employments.push({ continuationId, kind: 'CURRENT', employmentType: item.employmentType || null, annualIncome: decimal(item.annualIncome), position: text(item.position), phone: text(item.officePhone), workplaceAddress: text(item.officeAddress), startDate: date(item.startDate) });
  }
  if (data.previousEmployment) employments.push({ continuationId, kind: 'PREVIOUS', phone: text(data.previousEmployment.officePhone), history: text(data.previousEmployment.history) });
  if (employments.length) await tx.continuationEmployment.createMany({ data: employments });
  const businessProfiles: Prisma.ContinuationBusinessProfileCreateManyInput[] = [];
  if (data.currentEmployment?.employmentType === 'SELF_EMPLOYED') businessProfiles.push({ continuationId, applicantNumber: 1, ...businessProfileData(data.currentEmployment.business) });
  if (data.applicant2?.employmentStatus === 'SELF_EMPLOYED') businessProfiles.push({ continuationId, applicantNumber: 2, ...businessProfileData(data.applicant2.business) });
  if (businessProfiles.length) await tx.continuationBusinessProfile.createMany({ data: businessProfiles });
  const item = record(data.assetsAndLiabilities);
  const assets = { savings: text(item.savings), cars: text(item.cars), carLoans: text(item.carLoans), creditCards: text(item.creditCards), studentLoan: text(item.studentLoan), weeklyRent: decimal(item.weeklyRent), privateHealthInsurance: text(item.privateHealthInsurance) };
  await tx.continuationAssets.upsert({ where: { continuationId }, create: { continuationId, ...assets }, update: assets });
  if (data.properties?.items?.length) await tx.continuationProperty.createMany({ data: data.properties.items.map((property, position) => ({
    continuationId, position, use: property.use || null, address: text(property.address), propertyType: text(property.propertyType), bedrooms: integer(property.bedrooms), ownership: text(property.ownership),
    marketValue: decimal(property.marketValue), lender: text(property.lender), loanLimit: decimal(property.loanLimit), loanBalance: decimal(property.loanBalance), loanStartDate: date(property.loanStartDate), rentalPerWeek: decimal(property.rentalPerWeek), leasedThrough: property.leasedThrough || null,
  })) });
}

/** Old forms use their original JSON; version 2 reads typed answers, with only
 * lookup metadata and unstructured historical notes retained from the snapshot. */
export function continuationDetailsForResponse(continuation: ContinuationWithRecords): Record<string, unknown> {
  const details = structuredClone(record(continuation.details));
  if (continuation.formVersion < 2) return details;
  for (const key of ['applicant', 'applicant2']) delete details[key];
  for (const applicant of continuation.applicants) {
    const key = applicant.applicantNumber === 1 ? 'applicant' : 'applicant2';
    const snapshot = record(record(continuation.details)[key]);
    details[key] = {
      fullName: applicant.fullName ?? '', email: applicant.email ?? '', mobile: applicant.mobile ?? '',
      visaStatus: applicant.residencyStatus ?? '', maritalStatus: applicant.maritalStatus ?? '',
      residentialAddress: applicant.residentialAddress ?? '', residentialSince: dateText(applicant.residentialSince),
      residentialAddressSelection: snapshot.residentialAddressSelection,
      previousVisaStatus: snapshot.previousVisaStatus,
      housingArrangement: applicant.housingArrangement ?? '', dependents: applicant.dependents ?? '',
      ...(applicant.applicantNumber === 2 ? { employmentStatus: applicant.employmentStatus ?? '', annualIncome: applicant.annualIncome?.toString() ?? '' } : {}),
      previousAddresses: applicant.previousAddresses.map(address => ({ address: address.address ?? '', moveInDate: dateText(address.moveInDate), moveOutDate: dateText(address.moveOutDate), selection: (Array.isArray(snapshot.previousAddresses) ? snapshot.previousAddresses : []).map(record).find(item => item.address === address.address)?.selection })),
    };
  }
  delete details.currentEmployment;
  delete details.previousEmployment;
  for (const employment of continuation.employments) {
    if (employment.kind === 'CURRENT') details.currentEmployment = { annualIncome: employment.annualIncome?.toString() ?? '', employmentType: employment.employmentType ?? '', position: employment.position ?? '', officePhone: employment.phone ?? '', officeAddress: employment.workplaceAddress ?? '', officeAddressSelection: record(record(continuation.details).currentEmployment).officeAddressSelection, startDate: dateText(employment.startDate) };
    else details.previousEmployment = { officePhone: employment.phone ?? '', history: employment.history ?? '' };
  }
  const assets = continuation.assets;
  details.assetsAndLiabilities = assets ? { savings: assets.savings ?? '', cars: assets.cars ?? '', carLoans: assets.carLoans ?? '', creditCards: assets.creditCards ?? '', studentLoan: assets.studentLoan ?? '', weeklyRent: assets.weeklyRent?.toString() ?? '', privateHealthInsurance: assets.privateHealthInsurance ?? '' } : {};
  const snapshotProperties = record(details.properties);
  const originalProperties = Array.isArray(snapshotProperties.items) ? snapshotProperties.items.map(record) : [];
  details.properties = { ...snapshotProperties, items: continuation.properties.map(property => ({
    use: property.use ?? '', address: property.address ?? '', selection: originalProperties.find(item => item.address === property.address)?.selection,
    propertyType: property.propertyType ?? '', bedrooms: property.bedrooms ?? '', ownership: property.ownership ?? '',
    ...(property.use === 'INVESTMENT' ? { marketValue: property.marketValue?.toString() ?? '', lender: property.lender ?? '', loanLimit: property.loanLimit?.toString() ?? '', loanBalance: property.loanBalance?.toString() ?? '', loanStartDate: dateText(property.loanStartDate), rentalPerWeek: property.rentalPerWeek?.toString() ?? '', leasedThrough: property.leasedThrough ?? '' } : {}),
  })) };
  for (const profile of continuation.businessProfiles) {
    const key = profile.applicantNumber === 1 ? 'currentEmployment' : 'applicant2';
    details[key] = { ...record(details[key]), business: businessProfileForResponse(profile) };
  }
  return details;
}
