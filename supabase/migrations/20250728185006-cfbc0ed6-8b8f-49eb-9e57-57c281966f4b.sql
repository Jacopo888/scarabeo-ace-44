-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.update_profile_stats()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_queue_entries()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.matchmaking_queue 
  WHERE created_at < NOW() - INTERVAL '30 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_turn_deadline()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;