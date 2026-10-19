ALTER TABLE "generation_outputs"
  ADD COLUMN "saved_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Old data may contain multiple historical selections. Keep the most recent one.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY selected_at DESC, id DESC) AS rank
  FROM generation_outputs WHERE selected_at IS NOT NULL
)
UPDATE generation_outputs SET selected_at = NULL
WHERE id IN (SELECT id FROM ranked WHERE rank > 1);

CREATE UNIQUE INDEX "generation_outputs_one_selection_per_job"
  ON "generation_outputs" ("job_id") WHERE "selected_at" IS NOT NULL AND "deleted_at" IS NULL;

ALTER TABLE "generation_outputs" ADD CONSTRAINT "deleted_output_has_no_user_state"
  CHECK ("deleted_at" IS NULL OR ("selected_at" IS NULL AND "saved_at" IS NULL));
