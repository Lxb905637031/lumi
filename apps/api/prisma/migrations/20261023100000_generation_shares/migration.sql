CREATE TABLE "generation_shares" (
    "id" TEXT NOT NULL,
    "output_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generation_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generation_shares_token_hash_key" ON "generation_shares"("token_hash");
CREATE INDEX "generation_shares_output_id_revoked_at_idx" ON "generation_shares"("output_id", "revoked_at");
CREATE INDEX "generation_shares_expires_at_revoked_at_idx" ON "generation_shares"("expires_at", "revoked_at");
ALTER TABLE "generation_shares" ADD CONSTRAINT "generation_shares_output_id_fkey" FOREIGN KEY ("output_id") REFERENCES "generation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
