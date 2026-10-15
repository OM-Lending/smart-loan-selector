CREATE TYPE "ApplicationContinuationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

ALTER TABLE "applications"
  ADD COLUMN "recommendation_presented_at" TIMESTAMP(3),
  ADD COLUMN "apply_clicked_at" TIMESTAMP(3);

CREATE TABLE "application_continuations" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "selected_quote_id" UUID NOT NULL,
  "status" "ApplicationContinuationStatus" NOT NULL DEFAULT 'DRAFT',
  "details" JSONB NOT NULL DEFAULT '{}',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_continuations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_documents" (
  "id" UUID NOT NULL,
  "continuation_id" UUID NOT NULL,
  "category" VARCHAR(60) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_path" VARCHAR(500) NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_continuations_application_id_key" ON "application_continuations"("application_id");
CREATE UNIQUE INDEX "application_continuations_selected_quote_id_key" ON "application_continuations"("selected_quote_id");
CREATE UNIQUE INDEX "application_documents_storage_path_key" ON "application_documents"("storage_path");
CREATE INDEX "application_documents_continuation_id_category_idx" ON "application_documents"("continuation_id", "category");

ALTER TABLE "application_continuations"
  ADD CONSTRAINT "application_continuations_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_continuations"
  ADD CONSTRAINT "application_continuations_selected_quote_id_fkey"
  FOREIGN KEY ("selected_quote_id") REFERENCES "application_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_documents"
  ADD CONSTRAINT "application_documents_continuation_id_fkey"
  FOREIGN KEY ("continuation_id") REFERENCES "application_continuations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
