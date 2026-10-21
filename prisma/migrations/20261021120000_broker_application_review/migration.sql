ALTER TYPE "ApplicationStage" ADD VALUE 'BROKER_REVIEW' AFTER 'DOCUMENTS_PENDING';

CREATE TYPE "BrokerReviewStatus" AS ENUM ('NEW', 'IN_REVIEW', 'NEEDS_INFORMATION', 'READY_TO_SUBMIT');

ALTER TABLE "application_continuations"
  ADD COLUMN "review_status" "BrokerReviewStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "broker_note" VARCHAR(2000);

CREATE INDEX "application_continuations_review_status_idx"
  ON "application_continuations"("review_status");
