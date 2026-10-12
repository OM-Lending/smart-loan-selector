/*
  Warnings:

  - You are about to drop the column `records_added` on the `lender_sync_runs` table. All the data in the column will be lost.
  - You are about to drop the column `records_changed` on the `lender_sync_runs` table. All the data in the column will be lost.
  - You are about to drop the column `records_disabled` on the `lender_sync_runs` table. All the data in the column will be lost.
  - You are about to drop the column `records_seen` on the `lender_sync_runs` table. All the data in the column will be lost.
  - The `status` column on the `lender_sync_runs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `recommendation_runs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `application_id` to the `application_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source_observed_at` to the `application_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source_sync_run_id` to the `application_quotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `engine_version` to the `recommendation_runs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "loan_rates" DROP CONSTRAINT "loan_rates_product_id_fkey";

-- AlterTable
ALTER TABLE "application_quotes" ADD COLUMN     "application_id" UUID NOT NULL,
ADD COLUMN     "source_observed_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "source_sync_run_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "lender_sync_runs" DROP COLUMN "records_added",
DROP COLUMN "records_changed",
DROP COLUMN "records_disabled",
DROP COLUMN "records_seen",
ADD COLUMN     "products_added" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "products_disabled" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "products_seen" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rates_added" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rates_changed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rates_disabled" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rates_seen" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "SyncStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "loan_rate_history" ADD COLUMN     "effective_from" TIMESTAMP(3),
ADD COLUMN     "effective_to" TIMESTAMP(3),
ADD COLUMN     "source_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "loan_rates" ADD COLUMN     "last_sync_run_id" UUID;

-- AlterTable
ALTER TABLE "recommendation_runs" ADD COLUMN     "algorithm_hash" TEXT,
ADD COLUMN     "engine_version" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "RecommendationStatus" NOT NULL DEFAULT 'RUNNING';

-- CreateIndex
CREATE INDEX "application_quotes_application_id_idx" ON "application_quotes"("application_id");

-- AddForeignKey
ALTER TABLE "loan_rates" ADD CONSTRAINT "loan_rates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_source_sync_run_id_fkey" FOREIGN KEY ("source_sync_run_id") REFERENCES "lender_sync_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
