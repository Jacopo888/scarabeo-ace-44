import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { GameRecord } from '@/types/multiplayer'
import { gameParticipantFilters } from '@/lib/multiplayer/realtime'

type UseActiveGamesResult = {
  activeGames: GameRecord[]
  refresh: () => Promise<void>
}

/**
 * Subscribe to active/waiting games for a given user and keep the list fresh.
 */
export function useActiveGames(userId?: string | null, onError?: (msg: string) => void): UseActiveGamesResult {
  const [activeGames, setActiveGames] = useState<GameRecord[]>([])

  const fetchActiveGames = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          player1:profiles!games_player1_id_fkey(username, display_name),
          player2:profiles!games_player2_id_fkey(username, display_name)
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in('status', ['active', 'waiting'])
        .order('updated_at', { ascending: false })

      if (error) throw error
      setActiveGames((data as unknown) as GameRecord[])
    } catch (e) {
      console.error('Error fetching games:', e)
      onError?.('Unable to load games')
    }
  }, [userId, onError])

  useEffect(() => {
    if (!userId) return
    fetchActiveGames()
  }, [userId, fetchActiveGames])

  useEffect(() => {
    if (!userId) return
    const [player1Filter, player2Filter] = gameParticipantFilters(userId)
    const handleGameChange = () => {
      fetchActiveGames()
    }

    const channel = supabase
      .channel(`dashboard-games-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: player1Filter
        },
        handleGameChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: player2Filter
        },
        handleGameChange
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchActiveGames])

  return { activeGames, refresh: fetchActiveGames }
}
