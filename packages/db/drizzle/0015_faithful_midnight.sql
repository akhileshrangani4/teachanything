-- 1. Add user_id nullable so we can backfill before enforcing NOT NULL.
ALTER TABLE "crawl_sources" ADD COLUMN "user_id" text;--> statement-breakpoint

-- 2. Backfill ownership from the source's current chatbot.
UPDATE "crawl_sources" cs
SET "user_id" = c."user_id"
FROM "chatbots" c
WHERE c."id" = cs."chatbot_id";--> statement-breakpoint

-- 3. Enforce ownership.
ALTER TABLE "crawl_sources" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "crawl_sources" ADD CONSTRAINT "crawl_sources_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crawl_sources_user_id" ON "crawl_sources" USING btree ("user_id");--> statement-breakpoint

-- 4. Create the junction table.
CREATE TABLE "chatbot_crawl_source_associations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"crawl_source_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "chatbot_crawl_source_associations" ADD CONSTRAINT "chatbot_crawl_source_associations_chatbot_id_chatbots_id_fk"
  FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_crawl_source_associations" ADD CONSTRAINT "chatbot_crawl_source_associations_crawl_source_id_crawl_sources_id_fk"
  FOREIGN KEY ("crawl_source_id") REFERENCES "public"."crawl_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chatbot_crawl_source_assoc_chatbot_id_crawl_source_id_idx"
  ON "chatbot_crawl_source_associations" USING btree ("chatbot_id","crawl_source_id");--> statement-breakpoint

-- 5. Backfill the junction from existing source->chatbot bindings.
INSERT INTO "chatbot_crawl_source_associations" ("chatbot_id", "crawl_source_id")
SELECT "chatbot_id", "id" FROM "crawl_sources";--> statement-breakpoint

-- 6. Verify counts BEFORE dropping chatbot_id. Aborts the transaction if any
--    source failed to backfill (NULL user_id) or junction count != source count.
DO $$
DECLARE
  src_count int;
  assoc_count int;
  null_owner int;
BEGIN
  SELECT count(*) INTO src_count FROM "crawl_sources";
  SELECT count(*) INTO assoc_count FROM "chatbot_crawl_source_associations";
  SELECT count(*) INTO null_owner FROM "crawl_sources" WHERE "user_id" IS NULL;
  IF null_owner > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % crawl_sources have NULL user_id', null_owner;
  END IF;
  IF src_count <> assoc_count THEN
    RAISE EXCEPTION 'Backfill mismatch: % sources vs % associations', src_count, assoc_count;
  END IF;
END $$;--> statement-breakpoint

-- 7. Now safe to drop the old column + its index.
DROP INDEX IF EXISTS "idx_crawl_sources_chatbot_id";--> statement-breakpoint
ALTER TABLE "crawl_sources" DROP COLUMN "chatbot_id";
