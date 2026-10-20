ALTER TABLE "post_reports"
  ADD COLUMN "resolved_by_id" TEXT,
  ADD COLUMN "resolution_reason" TEXT;

ALTER TABLE "post_reports"
  ADD CONSTRAINT "post_reports_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
