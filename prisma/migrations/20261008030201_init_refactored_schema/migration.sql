-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'BROKER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('LEAD_CAPTURED', 'QUOTED', 'EXPIRED', 'RECOMMENDATION_SENT', 'APPLICATION_STARTED', 'DOCUMENTS_PENDING', 'SUBMITTED_TO_LENDER', 'PRE_APPROVED', 'UNCONDITIONAL_APPROVED', 'SETTLED');

-- CreateEnum
CREATE TYPE "LenderCategory" AS ENUM ('BIG_4', 'NON_BANK');

-- CreateEnum
CREATE TYPE "LoanGoal" AS ENUM ('BUY', 'REFINANCE');

-- CreateEnum
CREATE TYPE "RepaymentStructure" AS ENUM ('P_AND_I', 'INTEREST_ONLY');

-- CreateEnum
CREATE TYPE "RatePreference" AS ENUM ('VARIABLE', 'FIXED');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lenders" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "category" "LenderCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "description" TEXT,
    "max_lvr" DECIMAL(5,2),
    "min_limit" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_rates" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "rate_type" TEXT NOT NULL,
    "repayment_type" TEXT NOT NULL,
    "loan_purpose" TEXT NOT NULL,
    "interest_rate" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "loan_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal" "LoanGoal" NOT NULL,
    "buy_situation" TEXT,
    "is_first_home_buyer" BOOLEAN,
    "property_use" TEXT,
    "property_status" TEXT,
    "property_type" TEXT,
    "property_postcode" TEXT,
    "purchase_price" DECIMAL(12,2),
    "deposit" DECIMAL(12,2),
    "refinance_goal" TEXT,
    "cash_out_purpose" TEXT,
    "property_address" TEXT,
    "current_lender" TEXT,
    "property_value" DECIMAL(12,2),
    "current_loan_balance" DECIMAL(12,2),
    "current_interest_rate" DECIMAL(5,2),
    "current_repayment_type" TEXT,
    "is_fixed_rate" BOOLEAN,
    "fixed_rate_expiry" TEXT,
    "repayment_structure" "RepaymentStructure" NOT NULL,
    "interest_only_years" TEXT,
    "rate_preference" "RatePreference" NOT NULL,
    "fixed_years" TEXT,
    "employment_status" TEXT NOT NULL,
    "employment_start_date" TEXT,
    "gross_annual_salary" DECIMAL(12,2) NOT NULL,
    "relationship_status" TEXT NOT NULL,
    "partner_employment_status" TEXT,
    "partner_employment_start_date" TEXT,
    "partner_gross_salary" DECIMAL(12,2),
    "dependents" INTEGER NOT NULL DEFAULT 0,
    "has_existing_loans" BOOLEAN,
    "existing_monthly_repayment" DECIMAL(12,2),
    "has_credit_card" BOOLEAN,
    "credit_card_limit" DECIMAL(12,2),
    "current_stage" "ApplicationStage" NOT NULL DEFAULT 'LEAD_CAPTURED',
    "quoted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_quotes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quoted_rate" DECIMAL(5,2) NOT NULL,
    "quoted_rate_type" "RatePreference" NOT NULL,
    "quoted_repayment" "RepaymentStructure" NOT NULL,
    "calculated_lvr" DECIMAL(5,2),
    "monthly_repayment" DECIMAL(12,2),
    "rank" INTEGER NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_name_key" ON "lenders"("name");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_lender_id_external_id_key" ON "loan_products"("lender_id", "external_id");

-- CreateIndex
CREATE INDEX "loan_rates_product_id_idx" ON "loan_rates"("product_id");

-- CreateIndex
CREATE INDEX "application_quotes_application_id_idx" ON "application_quotes"("application_id");

-- AddForeignKey
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_rates" ADD CONSTRAINT "loan_rates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
