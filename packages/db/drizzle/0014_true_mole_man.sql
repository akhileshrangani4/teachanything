ALTER TYPE "public"."email_type" ADD VALUE 'request_more_info' BEFORE 'promote_admin';--> statement-breakpoint
ALTER TYPE "public"."email_type" ADD VALUE 'incorrect_info' BEFORE 'promote_admin';--> statement-breakpoint
ALTER TYPE "public"."email_type" ADD VALUE 'generic_admin_message' BEFORE 'promote_admin';