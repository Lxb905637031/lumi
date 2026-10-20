CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT');

CREATE TABLE "announcements" (
  "id" TEXT NOT NULL,
  "author_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "published_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_recipients" (
  "announcement_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "delivered_at" TIMESTAMP(3),
  CONSTRAINT "announcement_recipients_pkey" PRIMARY KEY ("announcement_id", "user_id")
);

CREATE UNIQUE INDEX "announcements_author_id_idempotency_key_key" ON "announcements"("author_id", "idempotency_key");
CREATE INDEX "announcements_status_published_at_id_idx" ON "announcements"("status", "published_at", "id");
CREATE INDEX "announcements_created_at_id_idx" ON "announcements"("created_at", "id");
CREATE INDEX "announcement_recipients_announcement_id_delivered_at_user_id_idx" ON "announcement_recipients"("announcement_id", "delivered_at", "user_id");
CREATE INDEX "announcement_recipients_user_id_announcement_id_idx" ON "announcement_recipients"("user_id", "announcement_id");

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
