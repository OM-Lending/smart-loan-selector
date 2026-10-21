CREATE TYPE "ProductRecommendationStatus" AS ENUM ('INCLUDED', 'EXCLUDED');

ALTER TABLE "loan_products"
  ADD COLUMN "recommendation_status" "ProductRecommendationStatus" NOT NULL DEFAULT 'INCLUDED',
  ADD COLUMN "recommendation_note" VARCHAR(1000),
  ADD COLUMN "recommendation_source_uri" TEXT,
  ADD COLUMN "recommendation_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "recommendation_reviewed_by_id" UUID;

CREATE INDEX "loan_products_is_active_recommendation_status_idx"
  ON "loan_products"("is_active", "recommendation_status");

ALTER TABLE "loan_products"
  ADD CONSTRAINT "loan_products_recommendation_reviewed_by_id_fkey"
  FOREIGN KEY ("recommendation_reviewed_by_id") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
