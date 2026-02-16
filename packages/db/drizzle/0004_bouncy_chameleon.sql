CREATE TYPE "public"."email_delivery_status" AS ENUM('queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_type" AS ENUM('admin_notification', 'approval', 'rejection', 'promote_admin', 'demote_admin', 'account_disabled', 'account_enabled', 'account_deleted', 'password_reset');--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_type" "email_type" NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"resend_message_id" text,
	"qstash_message_id" text,
	"delivery_status" "email_delivery_status" DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"last_event_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_deliveries_idempotency_key_unique" UNIQUE("idempotency_key")
);
