BEGIN;

-- CreateEnum
CREATE TYPE "ResidencyStatus" AS ENUM ('AUSTRALIAN_CITIZEN', 'PERMANENT_RESIDENT', 'TEMPORARY_RESIDENT');

-- CreateEnum
CREATE TYPE "OwnedPropertyUse" AS ENUM ('OWNER_OCCUPIED', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "LeasingArrangement" AS ENUM ('REAL_ESTATE_AGENT', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ContinuationEmploymentKind" AS ENUM ('CURRENT', 'PREVIOUS');

-- CreateEnum
CREATE TYPE "ApplicationDocumentCategory" AS ENUM ('identity', 'payslips', 'salary_bank_statements', 'ato_income_statement', 'car_loan_statement', 'student_loan_statement', 'mortgage_statement', 'council_rates', 'purchase_contract', 'rental_statement', 'other', 'income', 'bank_statements', 'liabilities', 'property', 'refinance');

-- AlterEnum
ALTER TYPE "EmploymentStatus" ADD VALUE 'SELF_EMPLOYED';

-- AlterTable
ALTER TABLE "application_continuations" ADD COLUMN     "form_version" SMALLINT NOT NULL DEFAULT 1;

-- AlterTable
-- Cast in place: retain all existing category values and attachments.
-- An unknown legacy category aborts the migration rather than silently rewriting it.
ALTER TABLE "application_documents"
  ALTER COLUMN "category" TYPE "ApplicationDocumentCategory"
  USING "category"::text::"ApplicationDocumentCategory";

-- CreateTable
CREATE TABLE "continuation_applicants" (
    "id" UUID NOT NULL,
    "continuation_id" UUID NOT NULL,
    "applicant_number" SMALLINT NOT NULL,
    "full_name" VARCHAR(200),
    "email" VARCHAR(254),
    "mobile" VARCHAR(24),
    "residency_status" "ResidencyStatus",
    "marital_status" "RelationshipStatus",
    "residential_address" VARCHAR(1000),
    "residential_since" DATE,
    "housing_arrangement" VARCHAR(500),
    "dependents" SMALLINT,
    "employment_status" "EmploymentStatus",
    "annual_income" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuation_applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuation_addresses" (
    "id" UUID NOT NULL,
    "applicant_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "address" VARCHAR(1000),
    "move_in_date" DATE,
    "move_out_date" DATE,

    CONSTRAINT "continuation_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuation_employments" (
    "id" UUID NOT NULL,
    "continuation_id" UUID NOT NULL,
    "kind" "ContinuationEmploymentKind" NOT NULL,
    "employment_type" "EmploymentStatus",
    "annual_income" DECIMAL(18,2),
    "position" VARCHAR(500),
    "phone" VARCHAR(24),
    "workplace_address" VARCHAR(1000),
    "start_date" DATE,
    "history" VARCHAR(10000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuation_employments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuation_assets" (
    "continuation_id" UUID NOT NULL,
    "savings" VARCHAR(5000),
    "cars" VARCHAR(5000),
    "car_loans" VARCHAR(5000),
    "credit_cards" VARCHAR(5000),
    "student_loan" VARCHAR(5000),
    "weekly_rent" DECIMAL(18,2),
    "private_health_insurance" VARCHAR(5000),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuation_assets_pkey" PRIMARY KEY ("continuation_id")
);

-- CreateTable
CREATE TABLE "continuation_properties" (
    "id" UUID NOT NULL,
    "continuation_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "use" "OwnedPropertyUse",
    "address" VARCHAR(1000),
    "property_type" VARCHAR(500),
    "bedrooms" SMALLINT,
    "ownership" VARCHAR(500),
    "market_value" DECIMAL(18,2),
    "lender" VARCHAR(120),
    "loan_limit" DECIMAL(18,2),
    "loan_balance" DECIMAL(18,2),
    "loan_start_date" DATE,
    "rental_per_week" DECIMAL(18,2),
    "leased_through" "LeasingArrangement",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuation_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "continuation_applicants_continuation_id_applicant_number_key" ON "continuation_applicants"("continuation_id", "applicant_number");

-- CreateIndex
CREATE UNIQUE INDEX "continuation_addresses_applicant_id_position_key" ON "continuation_addresses"("applicant_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "continuation_employments_continuation_id_kind_key" ON "continuation_employments"("continuation_id", "kind");

-- CreateIndex
CREATE INDEX "continuation_properties_use_idx" ON "continuation_properties"("use");

-- CreateIndex
CREATE UNIQUE INDEX "continuation_properties_continuation_id_position_key" ON "continuation_properties"("continuation_id", "position");

-- AddForeignKey
ALTER TABLE "continuation_applicants" ADD CONSTRAINT "continuation_applicants_continuation_id_fkey" FOREIGN KEY ("continuation_id") REFERENCES "application_continuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuation_addresses" ADD CONSTRAINT "continuation_addresses_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "continuation_applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuation_employments" ADD CONSTRAINT "continuation_employments_continuation_id_fkey" FOREIGN KEY ("continuation_id") REFERENCES "application_continuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuation_assets" ADD CONSTRAINT "continuation_assets_continuation_id_fkey" FOREIGN KEY ("continuation_id") REFERENCES "application_continuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuation_properties" ADD CONSTRAINT "continuation_properties_continuation_id_fkey" FOREIGN KEY ("continuation_id") REFERENCES "application_continuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nullable answers permit incomplete forms; these checks reject impossible values.
ALTER TABLE "application_continuations" ADD CONSTRAINT "continuation_form_version_check" CHECK ("form_version" IN (1, 2));
ALTER TABLE "continuation_applicants"
  ADD CONSTRAINT "continuation_applicant_number_check" CHECK ("applicant_number" IN (1, 2)),
  ADD CONSTRAINT "continuation_dependents_check" CHECK ("dependents" BETWEEN 0 AND 5),
  ADD CONSTRAINT "continuation_applicant_income_check" CHECK ("annual_income" > 0),
  ADD CONSTRAINT "continuation_marital_status_check" CHECK ("marital_status" IS NULL OR "marital_status"::text IN ('SINGLE', 'MARRIED', 'DE_FACTO'));
ALTER TABLE "continuation_addresses"
  ADD CONSTRAINT "continuation_address_position_check" CHECK ("position" BETWEEN 0 AND 49),
  ADD CONSTRAINT "continuation_address_dates_check" CHECK ("move_in_date" IS NULL OR "move_out_date" IS NULL OR "move_out_date" >= "move_in_date");
ALTER TABLE "continuation_employments" ADD CONSTRAINT "continuation_employment_income_check" CHECK ("annual_income" > 0);
ALTER TABLE "continuation_assets" ADD CONSTRAINT "continuation_weekly_rent_check" CHECK ("weekly_rent" >= 0);
ALTER TABLE "continuation_properties"
  ADD CONSTRAINT "continuation_property_position_check" CHECK ("position" BETWEEN 0 AND 49),
  ADD CONSTRAINT "continuation_property_bedrooms_check" CHECK ("bedrooms" >= 0),
  ADD CONSTRAINT "continuation_property_amounts_check" CHECK (
    ("market_value" IS NULL OR "market_value" >= 0) AND ("loan_limit" IS NULL OR "loan_limit" >= 0)
    AND ("loan_balance" IS NULL OR "loan_balance" >= 0) AND ("rental_per_week" IS NULL OR "rental_per_week" >= 0)),
  ADD CONSTRAINT "continuation_investment_fields_check" CHECK (
    "use" IS NOT DISTINCT FROM 'INVESTMENT'::"OwnedPropertyUse" OR (
      "market_value" IS NULL AND "lender" IS NULL AND "loan_limit" IS NULL AND "loan_balance" IS NULL
      AND "loan_start_date" IS NULL AND "rental_per_week" IS NULL AND "leased_through" IS NULL));

-- Browser/public roles receive no policies. Reads and writes use authenticated
-- application endpoints and the server database connection, as with other tables.
ALTER TABLE "continuation_applicants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "continuation_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "continuation_employments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "continuation_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "continuation_properties" ENABLE ROW LEVEL SECURITY;

COMMIT;
