CREATE TYPE "QuotaReservationStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');
CREATE TYPE "QuotaEventType" AS ENUM ('GRANT', 'RESERVE', 'COMMIT', 'RELEASE');

-- Existing jobs remain explicitly unmetered. Do not fabricate historical input or charges.
ALTER TABLE "generation_jobs" ADD COLUMN "execution_token" TEXT,
ADD COLUMN "input_snapshot" JSONB,
ADD COLUMN "lease_expires_at" TIMESTAMP(3),
ADD COLUMN "quota_attempt" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "generation_jobs_quota_attempt_nonnegative" CHECK ("quota_attempt" >= 0);

CREATE TABLE "quota_accounts" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "available" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "granted" INTEGER NOT NULL,
    "policy_version" TEXT NOT NULL DEFAULT 'free-trial-v1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quota_accounts_nonnegative" CHECK ("available" >= 0 AND "reserved" >= 0 AND "consumed" >= 0 AND "granted" >= 0),
    CONSTRAINT "quota_accounts_conservation" CHECK ("available" + "reserved" + "consumed" = "granted")
);

CREATE TABLE "quota_reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL CHECK ("attempt" > 0),
    "status" "QuotaReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "quota_ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT,
    "attempt" INTEGER,
    "event_key" TEXT NOT NULL,
    "type" "QuotaEventType" NOT NULL,
    "delta_available" INTEGER NOT NULL,
    "delta_reserved" INTEGER NOT NULL,
    "delta_consumed" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "quota_reservations_user_id_status_idx" ON "quota_reservations"("user_id", "status");
CREATE UNIQUE INDEX "quota_reservations_job_id_attempt_key" ON "quota_reservations"("job_id", "attempt");
CREATE UNIQUE INDEX "quota_ledger_event_key_key" ON "quota_ledger"("event_key");
CREATE INDEX "quota_ledger_user_id_created_at_idx" ON "quota_ledger"("user_id", "created_at");
CREATE INDEX "quota_ledger_job_id_idx" ON "quota_ledger"("job_id");
CREATE INDEX "generation_jobs_status_next_attempt_at_idx" ON "generation_jobs"("status", "next_attempt_at");
CREATE INDEX "generation_jobs_status_lease_expires_at_idx" ON "generation_jobs"("status", "lease_expires_at");
CREATE UNIQUE INDEX "generation_jobs_id_user_id_key" ON "generation_jobs"("id", "user_id");

ALTER TABLE "quota_accounts" ADD CONSTRAINT "quota_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_job_id_user_id_fkey" FOREIGN KEY ("job_id", "user_id") REFERENCES "generation_jobs"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "quota_accounts"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quota_ledger" ADD CONSTRAINT "quota_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "quota_accounts"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
