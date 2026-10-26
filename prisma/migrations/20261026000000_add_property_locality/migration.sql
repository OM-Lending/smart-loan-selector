BEGIN;

CREATE TYPE "AustralianState" AS ENUM ('ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA', 'OT');

-- Nullable so existing applications keep their original postcode without
-- inventing a suburb or state for postcodes shared by multiple localities.
ALTER TABLE "applications"
  ADD COLUMN "property_suburb" VARCHAR(100),
  ADD COLUMN "property_state" "AustralianState",
  ADD CONSTRAINT "applications_property_locality_complete_check" CHECK (
    ("property_suburb" IS NULL AND "property_state" IS NULL)
    OR (
      "property_suburb" IS NOT NULL
      AND "property_state" IS NOT NULL
      AND "property_postcode" IS NOT NULL
      AND "property_postcode" ~ '^[0-9]{4}$'
      AND "property_postcode" <> '0000'
      AND char_length(btrim("property_suburb")) >= 2
    )
  );

COMMIT;
