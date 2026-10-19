ALTER TABLE "posts" ADD COLUMN "idempotency_key" TEXT, ADD COLUMN "request_hash" TEXT;
ALTER TABLE "posts" ADD CONSTRAINT "post_request_key_and_hash_pair"
  CHECK (("idempotency_key" IS NULL) = ("request_hash" IS NULL));
CREATE UNIQUE INDEX "posts_author_id_idempotency_key_key" ON "posts" ("author_id", "idempotency_key");
CREATE INDEX "posts_image_asset_ids_idx" ON "posts" USING GIN ("image_asset_ids");
CREATE INDEX "generation_outputs_asset_id_deleted_at_idx" ON "generation_outputs" ("asset_id", "deleted_at");
