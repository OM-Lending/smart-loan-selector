CREATE TYPE "AdminMatchReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "admin_match_reviews" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "reviewer_profile_id" UUID NOT NULL,
    "decision" "AdminMatchReviewDecision" NOT NULL,
    "note" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_match_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_match_reviews_quote_id_created_at_idx"
    ON "admin_match_reviews"("quote_id", "created_at");
CREATE INDEX "admin_match_reviews_reviewer_profile_id_created_at_idx"
    ON "admin_match_reviews"("reviewer_profile_id", "created_at");

ALTER TABLE "admin_match_reviews"
    ADD CONSTRAINT "admin_match_reviews_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "application_quotes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_match_reviews"
    ADD CONSTRAINT "admin_match_reviews_reviewer_profile_id_fkey"
    FOREIGN KEY ("reviewer_profile_id") REFERENCES "profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
