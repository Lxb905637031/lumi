CREATE TYPE "MediaReviewStatus" AS ENUM ('UNREVIEWED', 'APPROVED', 'REJECTED');

ALTER TABLE "media_assets"
  ADD COLUMN "review_status" "MediaReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN "review_reason" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "media_assets_review_status_created_at_idx" ON "media_assets"("review_status", "created_at");

CREATE TABLE "media_review_actions" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "from_status" "MediaReviewStatus" NOT NULL,
  "to_status" "MediaReviewStatus" NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_review_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_review_actions_asset_id_created_at_idx" ON "media_review_actions"("asset_id", "created_at");
CREATE INDEX "media_review_actions_actor_id_created_at_idx" ON "media_review_actions"("actor_id", "created_at");

ALTER TABLE "media_review_actions"
  ADD CONSTRAINT "media_review_actions_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "media_review_actions_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
