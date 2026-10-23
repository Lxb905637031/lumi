CREATE TABLE "user_mutes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "reason" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "revoked_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_mutes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_mutes_user_id_starts_at_ends_at_revoked_at_idx"
  ON "user_mutes"("user_id", "starts_at", "ends_at", "revoked_at");
CREATE INDEX "user_mutes_actor_id_created_at_idx" ON "user_mutes"("actor_id", "created_at");
ALTER TABLE "user_mutes"
  ADD CONSTRAINT "user_mutes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "user_mutes_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "user_mutes_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
