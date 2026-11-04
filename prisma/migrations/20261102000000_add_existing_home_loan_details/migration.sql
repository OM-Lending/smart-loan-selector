BEGIN;

-- Keep old monthly repayments for historical applications. New details are
-- nullable so existing rows do not require invented lender or balance values.
ALTER TABLE "applications"
  ADD COLUMN "existing_loan_lender" VARCHAR(120),
  ADD COLUMN "existing_loan_interest_rate" DECIMAL(5,2),
  ADD COLUMN "existing_loan_balance" DECIMAL(14,2),
  ADD CONSTRAINT "applications_existing_home_loan_details_check" CHECK (
    (
      "existing_loan_lender" IS NULL
      AND "existing_loan_interest_rate" IS NULL
      AND "existing_loan_balance" IS NULL
    )
    OR (
      "has_existing_loans" IS TRUE
      AND "existing_loan_lender" IS NOT NULL
      AND char_length(btrim("existing_loan_lender")) >= 2
      AND "existing_loan_interest_rate" IS NOT NULL
      AND "existing_loan_interest_rate" BETWEEN 0.01 AND 99.99
      AND "existing_loan_balance" IS NOT NULL
      AND "existing_loan_balance" > 0
    )
  );

COMMIT;
