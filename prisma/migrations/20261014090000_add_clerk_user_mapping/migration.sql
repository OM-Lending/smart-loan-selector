ALTER TABLE "profiles"
ADD COLUMN "clerk_user_id" TEXT;

CREATE UNIQUE INDEX "profiles_clerk_user_id_key"
ON "profiles"("clerk_user_id");
