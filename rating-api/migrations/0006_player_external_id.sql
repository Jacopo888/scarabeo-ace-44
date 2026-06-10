ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "players_external_id_unique_idx" ON "players" USING btree ("external_id");
