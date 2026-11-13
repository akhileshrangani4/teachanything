CREATE TYPE "public"."message_rating" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TABLE "message_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"rating" "message_rating" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_ratings_message_id_session_id_unique" UNIQUE("message_id","session_id")
);
--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_ratings_chatbot_id_updated_at_idx" ON "message_ratings" USING btree ("chatbot_id","updated_at");