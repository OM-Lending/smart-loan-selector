BEGIN;

-- Preserve ambiguous historical answers. New application APIs only accept
-- SINGLE, MARRIED and DE_FACTO; MARRIED_DE_FACTO is retained for old records.
ALTER TYPE "RelationshipStatus" RENAME TO "RelationshipStatus_old";

CREATE TYPE "RelationshipStatus" AS ENUM ('SINGLE', 'MARRIED', 'DE_FACTO', 'MARRIED_DE_FACTO');

ALTER TABLE "applications"
  ALTER COLUMN "relationship_status" TYPE "RelationshipStatus"
  USING (
    CASE
      WHEN "relationship_status"::text IN ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED') THEN 'SINGLE'
      ELSE "relationship_status"::text
    END
  )::"RelationshipStatus";

DROP TYPE "RelationshipStatus_old";

-- Continuation JSON and recommendation snapshots are historical records.
-- Editable continuation answers are normalized by the API on read/save.
COMMIT;
