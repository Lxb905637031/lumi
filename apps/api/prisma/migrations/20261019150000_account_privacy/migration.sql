CREATE TYPE "AccountDeletionStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE "DataExportStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'READY', 'EXPIRED', 'FAILED');

CREATE TABLE "account_deletion_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AccountDeletionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "account_deletion_requests_user_id_key" ON "account_deletion_requests"("user_id");
CREATE INDEX "account_deletion_requests_status_scheduled_for_idx" ON "account_deletion_requests"("status", "scheduled_for");

CREATE TABLE "account_deletion_events" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "from_status" "AccountDeletionStatus",
    "to_status" "AccountDeletionStatus" NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_deletion_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "account_deletion_events_request_id_created_at_idx" ON "account_deletion_events"("request_id", "created_at");

CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "data_export_requests_user_id_created_at_idx" ON "data_export_requests"("user_id", "created_at");
CREATE INDEX "data_export_requests_status_created_at_idx" ON "data_export_requests"("status", "created_at");

ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_deletion_events" ADD CONSTRAINT "account_deletion_events_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "account_deletion_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
