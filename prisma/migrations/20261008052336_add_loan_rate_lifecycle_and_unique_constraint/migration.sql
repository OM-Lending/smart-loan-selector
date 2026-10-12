/*
  Warnings:

  - You are about to drop the column `application_id` on the `application_quotes` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `quoted_at` on the `applications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[product_id,rate_type,repayment_type,loan_purpose]` on the table `loan_rates` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lender_name` to the `application_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_name` to the `application_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recommendation_run_id` to the `application_quotes` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "application_quotes" DROP CONSTRAINT "application_quotes_application_id_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "loan_products" DROP CONSTRAINT "loan_products_lender_id_fkey";

-- DropIndex
DROP INDEX "application_quotes_application_id_idx";

-- DropIndex
DROP INDEX "loan_rates_product_id_idx";

-- AlterTable
ALTER TABLE "application_quotes" DROP COLUMN "application_id",
ADD COLUMN     "annual_fee" DECIMAL(10,2),
ADD COLUMN     "explanation" JSONB,
ADD COLUMN     "lender_name" TEXT NOT NULL,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "recommendation_run_id" UUID NOT NULL,
ADD COLUMN     "score" DECIMAL(8,4),
ALTER COLUMN "quoted_rate" SET DATA TYPE DECIMAL(7,4);

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "expires_at",
DROP COLUMN "quoted_at",
ALTER COLUMN "current_interest_rate" SET DATA TYPE DECIMAL(7,4);

-- AlterTable
ALTER TABLE "lenders" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "loan_rates" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "interest_rate" SET DATA TYPE DECIMAL(7,4);

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "phone_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lender_sync_runs" (
    "id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CDR',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "records_seen" INTEGER NOT NULL DEFAULT 0,
    "records_changed" INTEGER NOT NULL DEFAULT 0,
    "records_added" INTEGER NOT NULL DEFAULT 0,
    "records_disabled" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "lender_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_rate_history" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sync_run_id" UUID NOT NULL,
    "rate_type" TEXT NOT NULL,
    "repayment_type" TEXT NOT NULL,
    "loan_purpose" TEXT NOT NULL,
    "interest_rate" DECIMAL(7,4) NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,

    CONSTRAINT "loan_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_runs" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "rules_version" TEXT NOT NULL,
    "lender_data_as_of" TIMESTAMP(3) NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lender_sync_runs_lender_id_started_at_idx" ON "lender_sync_runs"("lender_id", "started_at");

-- CreateIndex
CREATE INDEX "loan_rate_history_product_id_observed_at_idx" ON "loan_rate_history"("product_id", "observed_at");

-- CreateIndex
CREATE INDEX "loan_rate_history_sync_run_id_idx" ON "loan_rate_history"("sync_run_id");

-- CreateIndex
CREATE INDEX "recommendation_runs_application_id_created_at_idx" ON "recommendation_runs"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "application_quotes_recommendation_run_id_idx" ON "application_quotes"("recommendation_run_id");

-- CreateIndex
CREATE INDEX "loan_rates_product_id_is_active_idx" ON "loan_rates"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "loan_rates_product_id_rate_type_repayment_type_loan_purpose_key" ON "loan_rates"("product_id", "rate_type", "repayment_type", "loan_purpose");

-- AddForeignKey
ALTER TABLE "lender_sync_runs" ADD CONSTRAINT "lender_sync_runs_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_rate_history" ADD CONSTRAINT "loan_rate_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_rate_history" ADD CONSTRAINT "loan_rate_history_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "lender_sync_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_recommendation_run_id_fkey" FOREIGN KEY ("recommendation_run_id") REFERENCES "recommendation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
