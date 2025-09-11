ALTER TABLE "tenants" ADD COLUMN "system_prompt" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ai_model" text DEFAULT 'gpt-4o-mini';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ai_temperature" numeric(3, 2) DEFAULT '0.7';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "language_detection" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "tg_webhook_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "kaspi_merchant_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "crm_webhook_url" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "two_gis_url" text;