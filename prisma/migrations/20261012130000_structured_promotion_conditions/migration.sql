-- Explicit, optional columns for common cashback qualification conditions.
-- Nullable fields mean “no condition configured”; first_home_buyer_only defaults
-- to false, preserving existing promotion behavior.
ALTER TABLE "promotions"
  ADD COLUMN "required_goal" "LoanGoal",
  ADD COLUMN "minimum_loan_amount" DECIMAL(12,2),
  ADD COLUMN "maximum_loan_amount" DECIMAL(12,2),
  ADD COLUMN "first_home_buyer_only" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "application_window_start" TIMESTAMP(3),
  ADD COLUMN "application_window_end" TIMESTAMP(3),
  ADD COLUMN "settlement_within_days" INTEGER,
  ADD COLUMN "drawdown_within_days" INTEGER;
