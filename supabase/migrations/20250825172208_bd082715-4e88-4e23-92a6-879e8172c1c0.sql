-- Add unique constraint to prevent duplicate daily puzzles
ALTER TABLE public.daily_puzzles
ADD CONSTRAINT daily_puzzles_yyyymmdd_unique UNIQUE (yyyymmdd);