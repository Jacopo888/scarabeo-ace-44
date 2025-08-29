CREATE TABLE "daily_puzzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"yyyymmdd" integer NOT NULL,
	"board" jsonb NOT NULL,
	"rack" jsonb NOT NULL,
	"best_score" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_puzzles_yyyymmdd_unique" UNIQUE("yyyymmdd")
);
--> statement-breakpoint
CREATE TABLE "daily_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"yyyymmdd" integer NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_scores_user_day_idx" ON "daily_scores" USING btree ("user_id","yyyymmdd");--> statement-breakpoint
CREATE INDEX "daily_scores_day_idx" ON "daily_scores" USING btree ("yyyymmdd");--> statement-breakpoint
CREATE INDEX "daily_scores_score_idx" ON "daily_scores" USING btree ("score" desc);