BEGIN;

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS', 'PRIVACY', 'COLLECTION_NOTICE');

-- CreateEnum
CREATE TYPE "LegalConsentPurpose" AS ENUM ('TERMS_ACCEPTANCE', 'QUOTE_COLLECTION', 'APPLICATION_COLLECTION', 'APPLICATION_SUBMISSION', 'BROKER_CONTACT');

-- CreateEnum
CREATE TYPE "LegalConsentAction" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LegalConsentSource" AS ENUM ('REGISTRATION', 'QUESTIONNAIRE', 'CONTINUATION', 'FINAL_SUBMISSION', 'BROKER_ENQUIRY');

-- CreateTable
CREATE TABLE "legal_document_versions" (
    "id" UUID NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "path" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_consent_records" (
    "id" UUID NOT NULL,
    "record_key" CHAR(64) NOT NULL,
    "purpose" "LegalConsentPurpose" NOT NULL,
    "action" "LegalConsentAction" NOT NULL DEFAULT 'GRANTED',
    "source" "LegalConsentSource" NOT NULL,
    "document_version_id" UUID NOT NULL,
    "profile_id" UUID,
    "clerk_user_id" VARCHAR(255),
    "application_id" UUID,
    "enquiry_id" UUID,
    "statement" VARCHAR(2000) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_versions_type_version_key" ON "legal_document_versions"("type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "legal_consent_records_record_key_key" ON "legal_consent_records"("record_key");

-- CreateIndex
CREATE INDEX "legal_consent_records_clerk_user_id_purpose_recorded_at_idx" ON "legal_consent_records"("clerk_user_id", "purpose", "recorded_at");

-- CreateIndex
CREATE INDEX "legal_consent_records_profile_id_idx" ON "legal_consent_records"("profile_id");

-- CreateIndex
CREATE INDEX "legal_consent_records_application_id_purpose_recorded_at_idx" ON "legal_consent_records"("application_id", "purpose", "recorded_at");

-- CreateIndex
CREATE INDEX "legal_consent_records_enquiry_id_idx" ON "legal_consent_records"("enquiry_id");

-- CreateIndex
CREATE INDEX "legal_consent_records_document_version_id_idx" ON "legal_consent_records"("document_version_id");

-- AddForeignKey
ALTER TABLE "legal_consent_records" ADD CONSTRAINT "legal_consent_records_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "legal_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_consent_records" ADD CONSTRAINT "legal_consent_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_consent_records" ADD CONSTRAINT "legal_consent_records_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_consent_records" ADD CONSTRAINT "legal_consent_records_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "broker_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A notice acknowledgement is scoped to one account, application or enquiry.
ALTER TABLE "legal_consent_records"
  ADD CONSTRAINT "legal_consent_actor_check" CHECK ("clerk_user_id" IS NOT NULL OR "enquiry_id" IS NOT NULL),
  ADD CONSTRAINT "legal_consent_scope_check" CHECK (
    ("purpose" = 'TERMS_ACCEPTANCE' AND "clerk_user_id" IS NOT NULL AND "application_id" IS NULL AND "enquiry_id" IS NULL)
    OR ("purpose" IN ('QUOTE_COLLECTION', 'APPLICATION_COLLECTION', 'APPLICATION_SUBMISSION') AND "application_id" IS NOT NULL AND "enquiry_id" IS NULL)
    OR ("purpose" = 'BROKER_CONTACT' AND "enquiry_id" IS NOT NULL AND "application_id" IS NULL)),
  ADD CONSTRAINT "legal_consent_statement_check" CHECK (length(trim("statement")) > 0);
ALTER TABLE "legal_document_versions"
  ADD CONSTRAINT "legal_document_hash_check" CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "legal_document_version_check" CHECK (length(trim("version")) > 0);

ALTER TABLE "legal_document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_consent_records" ENABLE ROW LEVEL SECURITY;
-- No historical acceptance is invented or backfilled. Current confirmations
-- create immutable-version snapshots and append-only application audit events.

COMMIT;
