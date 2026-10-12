CREATE TYPE "RuleParseStatus" AS ENUM ('PARSED', 'PARTIALLY_PARSED', 'UNPARSED');
CREATE TYPE "QuoteEligibilityStatus" AS ENUM ('ELIGIBLE', 'REVIEW_REQUIRED', 'INELIGIBLE');

ALTER TABLE "loan_products"
  ADD COLUMN "features" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "raw_payload" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "parse_status" "RuleParseStatus" NOT NULL DEFAULT 'PARSED';

-- Carry forward the existing product-wide filters into the canonical constraint table.

ALTER TABLE "loan_rates"
  ADD COLUMN "min_amount" DECIMAL(12,2),
  ADD COLUMN "max_amount" DECIMAL(12,2),
  ADD COLUMN "min_lvr" DECIMAL(5,2),
  ADD COLUMN "max_lvr" DECIMAL(5,2),
  ADD COLUMN "fixed_period_months" INTEGER,
  ADD COLUMN "rate_conditions" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "raw_rate" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "condition_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "parse_status" "RuleParseStatus" NOT NULL DEFAULT 'PARSED';

-- Existing rate rows are assigned a deterministic identity before changing the unique key.
UPDATE "loan_rates" SET "condition_hash" = md5(concat_ws('|', "rate_type", "repayment_type", "loan_purpose", "interest_rate"));
DROP INDEX IF EXISTS "loan_rates_product_id_rate_type_repayment_type_loan_purpose_key";
CREATE UNIQUE INDEX "loan_rates_product_id_condition_hash_key" ON "loan_rates"("product_id", "condition_hash");

CREATE TABLE "loan_product_constraints" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "constraint_type" TEXT NOT NULL,
  "numeric_value" DECIMAL(12,4),
  "unit" TEXT,
  "applicability" JSONB NOT NULL DEFAULT '{}',
  "parse_status" "RuleParseStatus" NOT NULL DEFAULT 'UNPARSED',
  "description" TEXT,
  "raw_constraint" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loan_product_constraints_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "loan_product_constraints_product_id_constraint_type_parse_status_idx"
  ON "loan_product_constraints"("product_id", "constraint_type", "parse_status");
ALTER TABLE "loan_product_constraints" ADD CONSTRAINT "loan_product_constraints_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "loan_product_constraints" ("id", "product_id", "constraint_type", "numeric_value", "unit", "parse_status", "raw_constraint", "updated_at")
SELECT gen_random_uuid(), p."id", 'MAX_LVR', CASE WHEN p."max_lvr" <= 1 THEN p."max_lvr" * 100 ELSE p."max_lvr" END, 'PERCENT', 'PARSED', jsonb_build_object('constraintType', 'MAX_LVR', 'additionalValue', p."max_lvr"::text), CURRENT_TIMESTAMP
FROM "loan_products" p WHERE p."max_lvr" IS NOT NULL;
INSERT INTO "loan_product_constraints" ("id", "product_id", "constraint_type", "numeric_value", "unit", "parse_status", "raw_constraint", "updated_at")
SELECT gen_random_uuid(), p."id", 'MIN_LIMIT', p."min_limit", 'AUD', 'PARSED', jsonb_build_object('constraintType', 'MIN_LIMIT', 'additionalValue', p."min_limit"::text), CURRENT_TIMESTAMP
FROM "loan_products" p WHERE p."min_limit" IS NOT NULL;

CREATE TABLE "loan_product_fees" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "external_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fee_type" TEXT NOT NULL,
  "fee_method" TEXT NOT NULL,
  "amount" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "frequency" TEXT,
  "parse_status" "RuleParseStatus" NOT NULL DEFAULT 'UNPARSED',
  "additional_info" TEXT,
  "raw_fee" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loan_product_fees_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loan_product_fees_product_id_external_key_key" ON "loan_product_fees"("product_id", "external_key");
CREATE INDEX "loan_product_fees_product_id_fee_type_idx" ON "loan_product_fees"("product_id", "fee_type");
ALTER TABLE "loan_product_fees" ADD CONSTRAINT "loan_product_fees_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loan_product_snapshots" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "sync_run_id" UUID NOT NULL,
  "content_hash" TEXT NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_product_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loan_product_snapshots_product_id_content_hash_key" ON "loan_product_snapshots"("product_id", "content_hash");
CREATE INDEX "loan_product_snapshots_product_id_observed_at_idx" ON "loan_product_snapshots"("product_id", "observed_at");
CREATE INDEX "loan_product_snapshots_sync_run_id_idx" ON "loan_product_snapshots"("sync_run_id");
ALTER TABLE "loan_product_snapshots" ADD CONSTRAINT "loan_product_snapshots_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_product_snapshots" ADD CONSTRAINT "loan_product_snapshots_sync_run_id_fkey"
  FOREIGN KEY ("sync_run_id") REFERENCES "lender_sync_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "application_quotes"
  ADD COLUMN "rate_id" UUID,
  ADD COLUMN "eligibility_status" "QuoteEligibilityStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
  ADD COLUMN "product_snapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "rate_snapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "fee_snapshot" JSONB NOT NULL DEFAULT '{}';
UPDATE "application_quotes" q SET "rate_id" = (
  SELECT r."id" FROM "loan_rates" r
  WHERE r."product_id" = q."product_id" AND r."interest_rate" = q."quoted_rate"
  ORDER BY r."last_observed_at" DESC LIMIT 1
);
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_rate_id_fkey"
  FOREIGN KEY ("rate_id") REFERENCES "loan_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
