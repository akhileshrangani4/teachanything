CREATE TYPE "public"."crawl_status" AS ENUM('pending', 'discovering', 'crawling', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."crawled_page_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'blocked', 'skipped');--> statement-breakpoint
CREATE TABLE "crawl_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"root_url" text NOT NULL,
	"status" "crawl_status" DEFAULT 'pending' NOT NULL,
	"crawl_depth" integer DEFAULT 3 NOT NULL,
	"max_pages" integer DEFAULT 10 NOT NULL,
	"include_patterns" jsonb DEFAULT '[]'::jsonb,
	"exclude_patterns" jsonb DEFAULT '[]'::jsonb,
	"last_crawled_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawled_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_source_id" uuid NOT NULL,
	"user_file_id" uuid,
	"url" text NOT NULL,
	"title" text,
	"content_hash" text,
	"depth" integer DEFAULT 0 NOT NULL,
	"status" "crawled_page_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_sources" ADD CONSTRAINT "crawl_sources_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_crawl_source_id_crawl_sources_id_fk" FOREIGN KEY ("crawl_source_id") REFERENCES "public"."crawl_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_user_file_id_user_files_id_fk" FOREIGN KEY ("user_file_id") REFERENCES "public"."user_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crawl_sources_chatbot_id" ON "crawl_sources" ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_crawled_pages_source_status" ON "crawled_pages" ("crawl_source_id", "status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crawled_pages_source_url" ON "crawled_pages" ("crawl_source_id", "url");
