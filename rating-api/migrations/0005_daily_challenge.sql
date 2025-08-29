DROP TABLE IF EXISTS "daily_scores";
DROP TABLE IF EXISTS "daily_puzzles";

CREATE TABLE "daily_puzzles" (
  "yyyymmdd" integer PRIMARY KEY,
  "board" jsonb NOT NULL,
  "racks" jsonb NOT NULL,
  "seed" text NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE "daily_scores" (
  "yyyymmdd" integer NOT NULL,
  "user_id" text NOT NULL,
  "score" integer NOT NULL,
  "submitted_at" timestamptz DEFAULT now(),
  CONSTRAINT "daily_scores_pkey" PRIMARY KEY ("yyyymmdd", "user_id")
);

CREATE INDEX "daily_scores_day_score_idx" ON "daily_scores" ("yyyymmdd", "score" DESC);
