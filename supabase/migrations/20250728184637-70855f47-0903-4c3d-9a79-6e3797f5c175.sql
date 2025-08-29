-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  skill_level INTEGER DEFAULT 1000, -- ELO-style rating
  preferred_game_duration TEXT DEFAULT '24h' CHECK (preferred_game_duration IN ('1h', '6h', '24h', '48h')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_player_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  winner_id UUID REFERENCES public.profiles(id),
  board_state JSONB NOT NULL DEFAULT '{}',
  tile_bag JSONB NOT NULL DEFAULT '[]',
  player1_rack JSONB NOT NULL DEFAULT '[]',
  player2_rack JSONB NOT NULL DEFAULT '[]',
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  turn_deadline TIMESTAMP WITH TIME ZONE,
  turn_duration TEXT DEFAULT '24h' CHECK (turn_duration IN ('1h', '6h', '24h', '48h')),
  pass_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT different_players CHECK (player1_id != player2_id),
  CONSTRAINT valid_current_player CHECK (current_player_id IN (player1_id, player2_id)),
  CONSTRAINT valid_winner CHECK (winner_id IS NULL OR winner_id IN (player1_id, player2_id))
);

-- Enable RLS on games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Games policies
CREATE POLICY "Players can view their own games" ON public.games
  FOR SELECT USING (auth.uid() IN (player1_id, player2_id));

CREATE POLICY "Players can update their own games" ON public.games
  FOR UPDATE USING (auth.uid() IN (player1_id, player2_id));

CREATE POLICY "System can insert games" ON public.games
  FOR INSERT WITH CHECK (true);

-- Create moves table
CREATE TABLE public.moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  move_type TEXT NOT NULL CHECK (move_type IN ('place_tiles', 'exchange_tiles', 'pass')),
  tiles_placed JSONB DEFAULT '[]',
  tiles_exchanged JSONB DEFAULT '[]',
  words_formed JSONB DEFAULT '[]',
  score_earned INTEGER DEFAULT 0,
  board_state_after JSONB NOT NULL,
  rack_after JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on moves
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- Moves policies
CREATE POLICY "Players can view moves for their games" ON public.moves
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND auth.uid() IN (games.player1_id, games.player2_id)
    )
  );

CREATE POLICY "Players can insert moves for their games" ON public.moves
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND auth.uid() = moves.player_id
      AND auth.uid() IN (games.player1_id, games.player2_id)
    )
  );

-- Create matchmaking queue table
CREATE TABLE public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_level INTEGER NOT NULL,
  preferred_duration TEXT NOT NULL CHECK (preferred_duration IN ('1h', '6h', '24h', '48h')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS on matchmaking queue
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Matchmaking queue policies
CREATE POLICY "Users can view queue entries" ON public.matchmaking_queue
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own queue entry" ON public.matchmaking_queue
  FOR ALL USING (auth.uid() = user_id);

-- Create function to update profile stats
CREATE OR REPLACE FUNCTION public.update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats for completed games
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update games_played for both players
    UPDATE public.profiles 
    SET games_played = games_played + 1,
        updated_at = NOW()
    WHERE id IN (NEW.player1_id, NEW.player2_id);
    
    -- Update games_won for winner
    IF NEW.winner_id IS NOT NULL THEN
      UPDATE public.profiles 
      SET games_won = games_won + 1,
          updated_at = NOW()
      WHERE id = NEW.winner_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating profile stats
CREATE TRIGGER update_profile_stats_trigger
  AFTER UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_stats();

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to clean up expired queue entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_queue_entries()
RETURNS void AS $$
BEGIN
  DELETE FROM public.matchmaking_queue 
  WHERE created_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create function to update game turn deadlines
CREATE OR REPLACE FUNCTION public.update_turn_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Set turn deadline based on turn duration
  NEW.turn_deadline = NOW() + 
    CASE NEW.turn_duration
      WHEN '1h' THEN INTERVAL '1 hour'
      WHEN '6h' THEN INTERVAL '6 hours'
      WHEN '24h' THEN INTERVAL '24 hours'
      WHEN '48h' THEN INTERVAL '48 hours'
      ELSE INTERVAL '24 hours'
    END;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating turn deadlines
CREATE TRIGGER update_turn_deadline_trigger
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  WHEN (OLD.current_player_id != NEW.current_player_id)
  EXECUTE FUNCTION public.update_turn_deadline();

-- Create indexes for performance
CREATE INDEX idx_games_player1 ON public.games(player1_id);
CREATE INDEX idx_games_player2 ON public.games(player2_id);
CREATE INDEX idx_games_current_player ON public.games(current_player_id);
CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_moves_game_id ON public.moves(game_id);
CREATE INDEX idx_moves_player_id ON public.moves(player_id);
CREATE INDEX idx_matchmaking_skill ON public.matchmaking_queue(skill_level);
CREATE INDEX idx_profiles_skill_level ON public.profiles(skill_level);

-- Enable realtime for games table
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;