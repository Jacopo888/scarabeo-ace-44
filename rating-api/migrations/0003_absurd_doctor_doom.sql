ALTER TABLE "rush_scores" DROP CONSTRAINT "rush_scores_user_id_players_id_fk";
--> statement-breakpoint
ALTER TABLE "rush_puzzles" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "rush_puzzles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "rush_scores" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "rush_scores" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "rush_scores" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "rush_scores" ALTER COLUMN "puzzle_id" SET DATA TYPE uuid;
