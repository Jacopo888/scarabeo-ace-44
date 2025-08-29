CREATE TABLE "rush_puzzles" (
	"id" serial PRIMARY KEY NOT NULL,
	"board" jsonb NOT NULL,
	"rack" jsonb NOT NULL,
	"best_score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rush_scores" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "puzzle_id" integer NOT NULL,
        "score" integer NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rush_scores" ADD CONSTRAINT "rush_scores_user_id_players_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rush_scores" ADD CONSTRAINT "rush_scores_puzzle_id_rush_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."rush_puzzles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rush_scores_puzzle_id_idx" ON "rush_scores" USING btree ("puzzle_id");--> statement-breakpoint
CREATE INDEX "rush_scores_user_id_idx" ON "rush_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rush_scores_score_idx" ON "rush_scores" USING btree ("score" desc);