CREATE TYPE "PromotionSourceChangeType" AS ENUM ('DISCOVERED', 'UPDATED', 'REMOVED');
CREATE TYPE "PromotionReviewStatus" AS ENUM ('REVIEW_REQUIRED', 'REVIEWED', 'IGNORED');
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'EXPIRED');
CREATE TYPE "PromotionType" AS ENUM ('CASHBACK');
CREATE TYPE "PromotionQualificationStatus" AS ENUM ('QUALIFIES', 'DOES_NOT_QUALIFY', 'NEEDS_REVIEW');

CREATE TABLE "promotion_source_snapshots" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "change_type" "PromotionSourceChangeType" NOT NULL,
    "source_feature" JSONB NOT NULL,
    "suggested_amount" DECIMAL(12,2),
    "amount_parse_status" "RuleParseStatus" NOT NULL DEFAULT 'UNPARSED',
    "review_status" "PromotionReviewStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "first_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    CONSTRAINT "promotion_source_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "promotion_source_snapshots_product_id_source_key_source_hash_key"
    ON "promotion_source_snapshots"("product_id", "source_key", "source_hash");
CREATE INDEX "promotion_source_snapshots_review_status_is_current_last_observed_at_idx"
    ON "promotion_source_snapshots"("review_status", "is_current", "last_observed_at");
CREATE INDEX "promotion_source_snapshots_product_id_source_key_is_current_idx"
    ON "promotion_source_snapshots"("product_id", "source_key", "is_current");
ALTER TABLE "promotion_source_snapshots" ADD CONSTRAINT "promotion_source_snapshots_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "source_snapshot_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "promotion_type" "PromotionType" NOT NULL DEFAULT 'CASHBACK',
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "eligibility_rules" JSONB NOT NULL DEFAULT '{}',
    "exclusion_rules" JSONB NOT NULL DEFAULT '{}',
    "terms" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "parse_status" "RuleParseStatus" NOT NULL DEFAULT 'UNPARSED',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "promotions_source_snapshot_id_version_key" ON "promotions"("source_snapshot_id", "version");
CREATE INDEX "promotions_status_valid_from_valid_until_idx" ON "promotions"("status", "valid_from", "valid_until");
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_source_snapshot_id_fkey"
    FOREIGN KEY ("source_snapshot_id") REFERENCES "promotion_source_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "application_quotes"
    ADD COLUMN "promotion_snapshot" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "comparison_cost" DECIMAL(12,2),
    ADD COLUMN "comparison_horizon_months" INTEGER;

ALTER TABLE "applications"
    ADD COLUMN "promotion_answers" JSONB NOT NULL DEFAULT '{}';
