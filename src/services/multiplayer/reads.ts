import { supabase } from '@/integrations/supabase/client'
import { GameRecord } from '@/types/multiplayer'

export async function fetchGameWithProfiles(gameId: string) {
  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      player1:profiles!games_player1_id_fkey(username, display_name),
      player2:profiles!games_player2_id_fkey(username, display_name)
    `)
    .eq('id', gameId)
    .single()

  if (error) throw error
  return data as unknown as GameRecord
}
