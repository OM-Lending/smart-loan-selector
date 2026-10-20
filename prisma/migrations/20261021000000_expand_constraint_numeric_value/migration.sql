-- Allow product constraints to retain large loan limits such as St.George's
-- AUD 100,000,000 maximum while keeping four decimal places of precision.
ALTER TABLE "loan_product_constraints"
  ALTER COLUMN "numeric_value" TYPE DECIMAL(18, 4)
  USING "numeric_value"::DECIMAL(18, 4);
