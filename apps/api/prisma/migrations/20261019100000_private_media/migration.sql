-- Additive migration: existing assets remain local/READY; no user rows are removed.
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'REJECTED', 'EXPIRED', 'DELETED');
ALTER TABLE "media_assets"
  ADD COLUMN "storage_driver" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "status" "MediaStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "staging_object_key" TEXT,
  ADD COLUMN "upload_request_key" TEXT,
  ADD COLUMN "upload_mime_type" TEXT,
  ADD COLUMN "upload_byte_size" INTEGER,
  ADD COLUMN "upload_expires_at" TIMESTAMP(3),
  ADD COLUMN "processing_token" TEXT,
  ADD COLUMN "processing_started_at" TIMESTAMP(3),
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER;
CREATE UNIQUE INDEX "media_assets_staging_object_key_key" ON "media_assets"("staging_object_key");
CREATE UNIQUE INDEX "media_assets_owner_id_upload_request_key_key" ON "media_assets"("owner_id", "upload_request_key");
CREATE INDEX "media_assets_status_upload_expires_at_idx" ON "media_assets"("status", "upload_expires_at");

CREATE TABLE "object_cleanup" (
  "id" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "not_before" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "object_cleanup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "object_cleanup_object_key_key" ON "object_cleanup"("object_key");
CREATE INDEX "object_cleanup_not_before_idx" ON "object_cleanup"("not_before");
