-- Allow resign move type
ALTER TABLE public.moves DROP CONSTRAINT IF EXISTS moves_move_type_check;
ALTER TABLE public.moves ADD CONSTRAINT moves_move_type_check CHECK (move_type IN ('place_tiles', 'exchange_tiles', 'pass', 'resign'));
