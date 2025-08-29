-- Create daily puzzles table
CREATE TABLE public.daily_puzzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yyyymmdd integer NOT NULL UNIQUE,
  board jsonb NOT NULL,
  rack jsonb NOT NULL,
  best_score integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create daily scores table  
CREATE TABLE public.daily_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  yyyymmdd integer NOT NULL,
  score integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create unique index to prevent duplicate user scores per day
CREATE UNIQUE INDEX daily_scores_user_day_idx ON public.daily_scores (user_id, yyyymmdd);

-- Create indexes for performance
CREATE INDEX daily_scores_day_idx ON public.daily_scores (yyyymmdd);
CREATE INDEX daily_scores_score_idx ON public.daily_scores (score DESC);

-- Enable RLS
ALTER TABLE public.daily_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_puzzles
CREATE POLICY "Anyone can view daily puzzles" 
ON public.daily_puzzles 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create today's puzzle if it doesn't exist" 
ON public.daily_puzzles 
FOR INSERT 
WITH CHECK (
  yyyymmdd = EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'UTC')) * 10000 + 
             EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'UTC')) * 100 + 
             EXTRACT(DAY FROM (NOW() AT TIME ZONE 'UTC'))
);

-- RLS Policies for daily_scores
CREATE POLICY "Anyone can view daily scores" 
ON public.daily_scores 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can submit score for today" 
ON public.daily_scores 
FOR INSERT 
WITH CHECK (
  yyyymmdd = EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'UTC')) * 10000 + 
             EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'UTC')) * 100 + 
             EXTRACT(DAY FROM (NOW() AT TIME ZONE 'UTC'))
);