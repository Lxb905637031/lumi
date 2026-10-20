CREATE TABLE "runtime_configs" (
  "id" TEXT NOT NULL,
  "config_key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "value" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "runtime_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runtime_configs_config_key_version_key" ON "runtime_configs"("config_key", "version");
CREATE INDEX "runtime_configs_config_key_created_at_idx" ON "runtime_configs"("config_key", "created_at");
