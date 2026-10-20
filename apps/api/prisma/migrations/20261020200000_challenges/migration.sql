CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

CREATE TABLE "challenges" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "challenges_slug_key" ON "challenges"("slug");
CREATE INDEX "challenges_status_starts_at_ends_at_idx" ON "challenges"("status", "starts_at", "ends_at");
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "challenge_participants" (
  "challenge_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),
  CONSTRAINT "challenge_participants_pkey" PRIMARY KEY ("challenge_id", "user_id")
);
CREATE INDEX "challenge_participants_user_id_left_at_joined_at_idx" ON "challenge_participants"("user_id", "left_at", "joined_at");
ALTER TABLE "challenge_participants"
  ADD CONSTRAINT "challenge_participants_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "challenge_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts" ADD COLUMN "challenge_id" TEXT;
CREATE INDEX "posts_challenge_id_moderation_status_created_at_idx" ON "posts"("challenge_id", "moderation_status", "created_at");
ALTER TABLE "posts" ADD CONSTRAINT "posts_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
