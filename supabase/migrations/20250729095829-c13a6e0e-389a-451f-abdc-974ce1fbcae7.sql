-- Enable realtime for game_chats
ALTER TABLE public.game_chats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_chats;