CREATE TYPE "EmploymentStatus" AS ENUM ('FULL_TIME', 'PART_TIME', 'CASUAL');

CREATE TYPE "RelationshipStatus" AS ENUM (
  'NEVER_MARRIED',
  'MARRIED',
  'DE_FACTO',
  'DIVORCED',
  'WIDOWED',
  'SINGLE',
  'MARRIED_DE_FACTO'
);

ALTER TABLE "applications"
  ALTER COLUMN "employment_status" TYPE "EmploymentStatus"
    USING "employment_status"::"EmploymentStatus",
  ALTER COLUMN "partner_employment_status" TYPE "EmploymentStatus"
    USING NULLIF("partner_employment_status", '')::"EmploymentStatus",
  ALTER COLUMN "relationship_status" TYPE "RelationshipStatus"
    USING "relationship_status"::"RelationshipStatus";
