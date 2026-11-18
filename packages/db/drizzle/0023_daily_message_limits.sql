ALTER TABLE "chatbots" ADD COLUMN "daily_message_limit" integer;--> statement-breakpoint
ALTER TABLE "chatbots" ADD COLUMN "paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "daily_message_limit" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "chatbots_paused" boolean DEFAULT false NOT NULL;