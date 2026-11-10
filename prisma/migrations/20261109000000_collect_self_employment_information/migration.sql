BEGIN;

-- AlterTable
ALTER TABLE "applications" ALTER COLUMN "gross_annual_salary" DROP NOT NULL;

-- CreateTable
CREATE TABLE "application_business_profiles" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "applicant_number" SMALLINT NOT NULL,
    "abn" VARCHAR(11),
    "commenced_on" DATE,
    "annual_net_profit_before_tax" DECIMAL(18,2),
    "financial_year_end" SMALLINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuation_business_profiles" (
    "id" UUID NOT NULL,
    "continuation_id" UUID NOT NULL,
    "applicant_number" SMALLINT NOT NULL,
    "abn" VARCHAR(11),
    "commenced_on" DATE,
    "annual_net_profit_before_tax" DECIMAL(18,2),
    "financial_year_end" SMALLINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuation_business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_business_profiles_application_id_applicant_numb_key" ON "application_business_profiles"("application_id", "applicant_number");

-- CreateIndex
CREATE UNIQUE INDEX "continuation_business_profiles_continuation_id_applicant_nu_key" ON "continuation_business_profiles"("continuation_id", "applicant_number");

-- AddForeignKey
ALTER TABLE "application_business_profiles" ADD CONSTRAINT "application_business_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuation_business_profiles" ADD CONSTRAINT "continuation_business_profiles_continuation_id_fkey" FOREIGN KEY ("continuation_id") REFERENCES "application_continuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_business_profiles"
  ADD CONSTRAINT "application_business_profiles_applicant_check" CHECK ("applicant_number" IN (1, 2)),
  ADD CONSTRAINT "application_business_profiles_abn_check" CHECK (
    "abn" IS NULL OR CASE WHEN "abn" ~ '^[0-9]{11}$' THEN (((substring("abn", 1, 1)::integer - 1) * 10) + ((substring("abn", 2, 1)::integer) * 1) + ((substring("abn", 3, 1)::integer) * 3) + ((substring("abn", 4, 1)::integer) * 5) + ((substring("abn", 5, 1)::integer) * 7) + ((substring("abn", 6, 1)::integer) * 9) + ((substring("abn", 7, 1)::integer) * 11) + ((substring("abn", 8, 1)::integer) * 13) + ((substring("abn", 9, 1)::integer) * 15) + ((substring("abn", 10, 1)::integer) * 17) + ((substring("abn", 11, 1)::integer) * 19)) % 89 = 0 ELSE FALSE END),
  ADD CONSTRAINT "application_business_profiles_financial_year_check" CHECK ("financial_year_end" BETWEEN 1901 AND 9999),
  ADD CONSTRAINT "application_business_profiles_profit_period_check" CHECK (("annual_net_profit_before_tax" IS NULL) = ("financial_year_end" IS NULL)),
  ADD CONSTRAINT "application_business_profiles_commencement_period_check" CHECK (
    "commenced_on" IS NULL OR "financial_year_end" IS NULL OR "commenced_on" <= make_date("financial_year_end", 6, 30));
ALTER TABLE "application_business_profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "continuation_business_profiles"
  ADD CONSTRAINT "continuation_business_profiles_applicant_check" CHECK ("applicant_number" IN (1, 2)),
  ADD CONSTRAINT "continuation_business_profiles_abn_check" CHECK (
    "abn" IS NULL OR CASE WHEN "abn" ~ '^[0-9]{11}$' THEN (((substring("abn", 1, 1)::integer - 1) * 10) + ((substring("abn", 2, 1)::integer) * 1) + ((substring("abn", 3, 1)::integer) * 3) + ((substring("abn", 4, 1)::integer) * 5) + ((substring("abn", 5, 1)::integer) * 7) + ((substring("abn", 6, 1)::integer) * 9) + ((substring("abn", 7, 1)::integer) * 11) + ((substring("abn", 8, 1)::integer) * 13) + ((substring("abn", 9, 1)::integer) * 15) + ((substring("abn", 10, 1)::integer) * 17) + ((substring("abn", 11, 1)::integer) * 19)) % 89 = 0 ELSE FALSE END),
  ADD CONSTRAINT "continuation_business_profiles_financial_year_check" CHECK ("financial_year_end" BETWEEN 1901 AND 9999),
  ADD CONSTRAINT "continuation_business_profiles_profit_period_check" CHECK (("annual_net_profit_before_tax" IS NULL) = ("financial_year_end" IS NULL)),
  ADD CONSTRAINT "continuation_business_profiles_commencement_period_check" CHECK (
    "commenced_on" IS NULL OR "financial_year_end" IS NULL OR "commenced_on" <= make_date("financial_year_end", 6, 30));
ALTER TABLE "continuation_business_profiles" ENABLE ROW LEVEL SECURITY;

-- SE declarations must never be disguised as PAYG salary values.
ALTER TABLE "applications"
  ADD CONSTRAINT "applications_salary_employment_check" CHECK (
    ("employment_status" = 'SELF_EMPLOYED' AND "gross_annual_salary" IS NULL AND "employment_start_date" IS NULL)
    OR ("employment_status" <> 'SELF_EMPLOYED' AND "gross_annual_salary" IS NOT NULL)),
  ADD CONSTRAINT "applications_partner_se_salary_check" CHECK (
    "partner_employment_status" IS DISTINCT FROM 'SELF_EMPLOYED'::"EmploymentStatus"
    OR ("partner_gross_salary" IS NULL AND "partner_employment_start_date" IS NULL));

COMMIT;
