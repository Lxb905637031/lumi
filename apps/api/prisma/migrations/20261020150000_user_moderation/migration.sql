CREATE TABLE "user_moderation_actions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "from_status" "UserStatus" NOT NULL,
  "to_status" "UserStatus" NOT NULL,
  "from_role" "UserRole" NOT NULL,
  "to_role" "UserRole" NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_moderation_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_moderation_actions_user_id_created_at_idx" ON "user_moderation_actions"("user_id", "created_at");
CREATE INDEX "user_moderation_actions_actor_id_created_at_idx" ON "user_moderation_actions"("actor_id", "created_at");

ALTER TABLE "user_moderation_actions" ADD CONSTRAINT "user_moderation_actions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_moderation_actions" ADD CONSTRAINT "user_moderation_actions_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
