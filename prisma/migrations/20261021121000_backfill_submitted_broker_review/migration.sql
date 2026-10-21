UPDATE "applications" AS application
SET "current_stage" = 'BROKER_REVIEW'
FROM "application_continuations" AS continuation
WHERE continuation."application_id" = application."id"
  AND continuation."status" = 'SUBMITTED'
  AND application."current_stage" = 'DOCUMENTS_PENDING';
