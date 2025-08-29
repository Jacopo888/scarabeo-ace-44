-- Create game_chats table for in-game messaging
CREATE TABLE public.game_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL,
  player_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.game_chats ENABLE ROW LEVEL SECURITY;

-- Create policies for game chat access
CREATE POLICY "Players can view chats for their games" 
ON public.game_chats 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = game_chats.game_id 
    AND (auth.uid() = games.player1_id OR auth.uid() = games.player2_id)
  )
);

CREATE POLICY "Players can insert chats for their games" 
ON public.game_chats 
FOR INSERT 
WITH CHECK (
  auth.uid() = player_id AND
  EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = game_chats.game_id 
    AND (auth.uid() = games.player1_id OR auth.uid() = games.player2_id)
  )
);

-- Create index for better performance
CREATE INDEX idx_game_chats_game_id ON public.game_chats(game_id);
CREATE INDEX idx_game_chats_created_at ON public.game_chats(created_at);

-- Enable realtime for game_chats
ALTER TABLE public.game_chats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_chats;