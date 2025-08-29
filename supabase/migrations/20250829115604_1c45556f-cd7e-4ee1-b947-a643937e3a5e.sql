-- Create puzzles table for generated puzzles
CREATE TABLE IF NOT EXISTS public.puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board JSONB NOT NULL,
  rack JSONB NOT NULL,
  best_score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create puzzle_scores table for user scores
CREATE TABLE IF NOT EXISTS public.puzzle_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES public.puzzles(id),
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(puzzle_id, user_id)
);

-- Enable RLS
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_scores ENABLE ROW LEVEL SECURITY;

-- Policies for puzzles (public read)
CREATE POLICY "Anyone can view puzzles" ON public.puzzles FOR SELECT USING (true);
CREATE POLICY "System can insert puzzles" ON public.puzzles FOR INSERT WITH CHECK (true);

-- Policies for puzzle_scores
CREATE POLICY "Anyone can view puzzle scores" ON public.puzzle_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert puzzle scores" ON public.puzzle_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own scores" ON public.puzzle_scores FOR UPDATE USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_puzzle_scores_puzzle_id ON public.puzzle_scores(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_scores_score ON public.puzzle_scores(score DESC);