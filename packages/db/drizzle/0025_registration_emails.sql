ALTER TYPE "public"."email_type" ADD VALUE 'request_more_info';--> statement-breakpoint
ALTER TYPE "public"."email_type" ADD VALUE 'incorrect_info';--> statement-breakpoint
ALTER TYPE "public"."email_type" ADD VALUE 'generic_admin_message';--> statement-breakpoint
CREATE INDEX "email_deliveries_recipient_created_idx" ON "email_deliveries" USING btree ("recipient_email","created_at");