import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { MatchmakingEntry, GameRecord } from '@/types/multiplayer'
import { TILE_DISTRIBUTION, Tile } from '@/types/game'
import { useToast } from '@/hooks/use-toast'

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const drawTiles = (bag: Tile[], count: number): { drawn: Tile[]; remaining: Tile[] } => {
  const drawn = bag.slice(0, count)
  const remaining = bag.slice(count)
  return { drawn, remaining }
}

export const useMatchmaking = () => {
  const [isInQueue, setIsInQueue] = useState(false)
  const [queueEntry, setQueueEntry] = useState<MatchmakingEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const { user, profile } = useAuth()
  const { toast } = useToast()

  // Check if user is already in queue
  useEffect(() => {
    if (user && profile) {
      checkQueueStatus()
    }
  }, [user, profile])

  // Set up real-time subscription for matchmaking
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('matchmaking-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
          filter: `player1_id=eq.${user.id},player2_id=eq.${user.id}`
        },
        (payload) => {
          const game = payload.new as GameRecord
          if (game.player1_id === user.id || game.player2_id === user.id) {
            handleGameFound(game)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const checkQueueStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking queue status:', error)
        return
      }

      if (data) {
        setQueueEntry(data as MatchmakingEntry)
        setIsInQueue(true)
      } else {
        setQueueEntry(null)
        setIsInQueue(false)
      }
    } catch (error) {
      console.error('Error checking queue status:', error)
    }
  }

  const joinQueue = async (preferredDuration: '1h' | '6h' | '24h' | '48h') => {
    if (!user || !profile) return

    setLoading(true)

    try {
      // Clean up expired entries first
      await supabase.rpc('cleanup_expired_queue_entries')

      // Try to find an existing match
      const { data: potentialMatches, error: searchError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('preferred_duration', preferredDuration)
        .neq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (searchError) {
        throw searchError
      }

      if (potentialMatches && potentialMatches.length > 0) {
        // Found a match! Create a game
        const opponent = potentialMatches[0]
        await createGame(user.id, opponent.user_id, preferredDuration)

        // Remove both players from queue
        await supabase
          .from('matchmaking_queue')
          .delete()
          .in('user_id', [user.id, opponent.user_id])

        toast({
          title: 'Match found!',
          description: 'A new game has been created. Good luck!'
        })
      } else {
        // No match found, join the queue
        const { error } = await supabase
          .from('matchmaking_queue')
          .upsert({
            user_id: user.id,
            skill_level: profile.skill_level,
            preferred_duration: preferredDuration
          })

        if (error) {
          throw error
        }

        setIsInQueue(true)
        await checkQueueStatus()

        toast({
          title: 'Matchmaking queue',
          description: 'Searching for an opponent for you...'
        })
      }
    } catch (error) {
      console.error('Error joining queue:', error)
      toast({
        title: 'Error',
        description: 'Unable to join matchmaking queue',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const leaveQueue = async () => {
    if (!user) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        throw error
      }

      setIsInQueue(false)
      setQueueEntry(null)

      toast({
        title: 'Left queue',
        description: 'You left the matchmaking queue'
      })
    } catch (error) {
      console.error('Error leaving queue:', error)
      toast({
        title: 'Error',
        description: 'Unable to leave the queue',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const createGame = async (
    player1Id: string,
    player2Id: string,
    duration: string
  ) => {
    const initialBoard = {}

    // Shuffle full tile distribution and draw starting racks
    const shuffledBag = shuffleArray(TILE_DISTRIBUTION)
    const player1Tiles = drawTiles(shuffledBag, 7)
    const player2Tiles = drawTiles(player1Tiles.remaining, 7)

    const initialTileBag = player2Tiles.remaining
    const player1Rack = player1Tiles.drawn
    const player2Rack = player2Tiles.drawn

    const { error } = await supabase
      .from('games')
      .insert({
        player1_id: player1Id,
        player2_id: player2Id,
        current_player_id: player1Id,
        status: 'active',
        board_state: initialBoard as any,
        tile_bag: initialTileBag as any,
        player1_rack: player1Rack as any,
        player2_rack: player2Rack as any,
        turn_duration: duration
      })

    if (error) {
      throw error
    }
  }

  const handleGameFound = (game: GameRecord) => {
    // Remove from queue if found
    setIsInQueue(false)
    setQueueEntry(null)

    toast({
      title: 'Match found!',
      description: 'A new game has been created. Go to the dashboard to play!'
    })
  }

  return {
    isInQueue,
    queueEntry,
    loading,
    joinQueue,
    leaveQueue,
    checkQueueStatus
  }
}