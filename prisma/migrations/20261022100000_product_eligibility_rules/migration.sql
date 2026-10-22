ALTER TABLE "loan_products"
  ADD COLUMN "recommendation_eligibility_rules" JSONB NOT NULL DEFAULT '{}'::jsonb;
