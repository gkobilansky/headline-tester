CREATE TABLE IF NOT EXISTS "WidgetExperiment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(128) NOT NULL,
	"path" text NOT NULL,
	"selector" text,
	"controlHeadline" text,
	"variantHeadline" text,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"authorId" uuid,
	"authorLabel" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "WidgetExperiment" ADD CONSTRAINT "WidgetExperiment_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "WidgetExperiment_token_path_idx" ON "WidgetExperiment" ("token","path");
