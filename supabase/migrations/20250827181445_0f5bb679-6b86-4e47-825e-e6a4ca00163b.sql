-- Add missing fields to moves table for comprehensive analysis
ALTER TABLE public.moves 
ADD COLUMN IF NOT EXISTS move_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS word TEXT,
ADD COLUMN IF NOT EXISTS rack_before JSONB DEFAULT '[]'::jsonb;

-- Create index for move ordering
CREATE INDEX IF NOT EXISTS idx_moves_game_order 
ON public.moves (game_id, move_index);

-- Add comment to clarify the enhanced moves structure
COMMENT ON TABLE public.moves IS 'Enhanced moves table with analysis-ready fields: move_index for ordering, word for primary word played, rack_before for pre-move rack state';