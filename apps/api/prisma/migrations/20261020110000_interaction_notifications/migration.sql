ALTER TYPE "NotificationType" ADD VALUE 'INTERACTION';
ALTER TABLE "notifications" ADD COLUMN "comment_id" TEXT, ADD COLUMN "event_key" TEXT;
CREATE UNIQUE INDEX "notifications_event_key_key" ON "notifications"("event_key");
