import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { GameRecord, MoveRecord } from '@/types/multiplayer'
import { GameState, Tile, PlacedTile } from '@/types/game'
import { useToast } from '@/hooks/use-toast'
import { validateMoveLogic } from '@/utils/moveValidation'
import { findNewWordsFormed } from '@/utils/newWordFinder'
import { calculateNewMoveScore } from '@/utils/newScoring'
import { canEndGame, calculateEndGamePenalty } from '@/utils/gameRules'
import { useDictionary } from '@/contexts/DictionaryContext'

const API_BASE = import.meta.env.VITE_RATING_API_URL || (import.meta.env.MODE === 'development' ? '/api' : '')

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

export const useMultiplayerGame = (gameId: string) => {
  const [game, setGame] = useState<GameRecord | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [pendingTiles, setPendingTiles] = useState<PlacedTile[]>([])
  const [loading, setLoading] = useState(true)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const { isValidWord } = useDictionary()

  // Fetch initial game data
  useEffect(() => {
    if (gameId && user) {
      fetchGame()
    }
  }, [gameId, user])

  // Set up real-time subscription
  useEffect(() => {
    if (!gameId || !user) return

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          const updatedGame = payload.new as GameRecord
          setGame(updatedGame)
          updateGameState(updatedGame)
          
          // Notify when it's the player's turn
          if (updatedGame.current_player_id === user.id && updatedGame.current_player_id !== game?.current_player_id) {
            toast({
              title: "It's your turn!",
              description: "You can make your move now"
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves',
          filter: `game_id=eq.${gameId}`
        },
        () => {
          // Refetch game when new move is made
          fetchGame()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, user, game?.current_player_id])

  const fetchGame = async () => {
    if (!gameId || !user) return

    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          player1:profiles!games_player1_id_fkey(username, display_name),
          player2:profiles!games_player2_id_fkey(username, display_name)
        `)
        .eq('id', gameId)
        .single()

      if (error) {
        throw error
      }

      setGame(data as unknown as GameRecord)
      updateGameState(data as unknown as GameRecord)
    } catch (error) {
      console.error('Error fetching game:', error)
      toast({
        title: "Error",
        description: "Unable to load the game",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateGameState = (gameData: GameRecord) => {
    if (!user) return

    const boardEntries = Object.entries(gameData.board_state || {}).map(
      ([key, val]) => {
        const tile: PlacedTile = {
          ...val,
          isBlank: val.isBlank ?? (val.letter === '' && val.points === 0)
        }
        return [key, tile] as [string, PlacedTile]
      }
    )
    const boardMap = new Map<string, PlacedTile>(boardEntries)

    const normalizeRack = (rack: Tile[]): Tile[] =>
      rack.map((t) => ({
        letter: t.letter ?? '',
        points: t.points ?? 0,
        isBlank: t.isBlank ?? (t.letter === '' && t.points === 0),
      }))

    const state: GameState = {
      players: [
        {
          id: gameData.player1_id,
          name: 'Player 1',
          score: gameData.player1_score,
          rack: normalizeRack(gameData.player1_rack || []),
        },
        {
          id: gameData.player2_id,
          name: 'Player 2',
          score: gameData.player2_score,
          rack: normalizeRack(gameData.player2_rack || []),
        },
      ],
      currentPlayerIndex: gameData.current_player_id === gameData.player1_id ? 0 : 1,
      board: boardMap,
      tileBag: gameData.tile_bag,
      gameStatus: 'playing'
    }

    setGameState(state)
    setIsMyTurn(gameData.current_player_id === user.id)
  }

  const placeTile = useCallback((row: number, col: number, tile: Tile) => {
    if (!isMyTurn) return

    const newTile: PlacedTile = {
      ...tile,
      row,
      col
    }

    setPendingTiles(prev => {
      const filtered = prev.filter(t => !(t.row === row && t.col === col))
      return [...filtered, newTile]
    })
  }, [isMyTurn])

  const pickupTile = useCallback((row: number, col: number) => {
    setPendingTiles(prev => prev.filter(t => !(t.row === row && t.col === col)))
  }, [])

  // Helper function to calculate the primary word from placed tiles
  const calculatePrimaryWord = (tilesPlaced: any[], boardState: any) => {
    if (tilesPlaced.length === 0) return ''
    
    // Sort tiles by position to determine word direction and order
    const sortedTiles = [...tilesPlaced].sort((a, b) => {
      if (a.row === b.row) return a.col - b.col
      return a.row - b.row
    })
    
    // Simple primary word extraction - in a real implementation this would be more sophisticated
    return sortedTiles.map(tile => tile.letter).join('')
  }

  // Helper function to get next move index for a game
  const getNextMoveIndex = async (gameId: string): Promise<number> => {
    const { data } = await supabase
      .from('moves')
      .select('move_index')
      .eq('game_id', gameId)
      .order('move_index', { ascending: false })
      .limit(1)
    
    return data && data.length > 0 ? data[0].move_index + 1 : 1
  }
    const submitMove = async () => {

    try {
      setLoading(true)

      // Prepare board map for validation and scoring
      const boardMap = new Map<string, PlacedTile>(
        Object.entries(game.board_state || {}) as [string, PlacedTile][]
      )

      const validation = validateMoveLogic(boardMap, pendingTiles)
      if (!validation.isValid) {
        toast({
          title: 'Invalid move',
          description: validation.errors.join(', '),
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const newWords = findNewWordsFormed(boardMap, pendingTiles)
      const invalid = newWords.filter(w => !isValidWord(w.word))
      if (invalid.length > 0) {
        toast({
          title: 'Invalid words',
          description: invalid.map(w => w.word).join(', '),
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const moveScore = calculateNewMoveScore(newWords, pendingTiles)

      // Apply tiles to board map
      pendingTiles.forEach(tile => {
        const key = `${tile.row},${tile.col}`
        boardMap.set(key, tile)
      })

      const newBoardState = Object.fromEntries(boardMap)

      // Remove used tiles from rack more carefully to prevent duplicates
      const isPlayer1 = game.player1_id === user.id
      const currentRack = [...(isPlayer1 ? game.player1_rack : game.player2_rack)] as Tile[]
      let newRack = [...currentRack]

      pendingTiles.forEach(placedTile => {
        const tileIndex = newRack.findIndex(rackTile => {
          if (placedTile.isBlank && rackTile.isBlank) return true
          return (
            rackTile.letter === placedTile.letter &&
            rackTile.points === placedTile.points &&
            rackTile.isBlank === placedTile.isBlank
          )
        })
        if (tileIndex !== -1) {
          newRack.splice(tileIndex, 1)
        }
      })

      // Draw new tiles to refill rack
      const tilesNeeded = 7 - newRack.length
      const { drawn, remaining } =
        tilesNeeded > 0 && game.tile_bag.length > 0
          ? drawTiles(game.tile_bag, Math.min(tilesNeeded, game.tile_bag.length))
          : { drawn: [], remaining: game.tile_bag }
      newRack = [...newRack, ...drawn]

      // Determine next player
      const nextPlayerId = game.current_player_id === game.player1_id 
        ? game.player2_id 
        : game.player1_id

      // Update game state
      const gameUpdate: Partial<GameRecord> = {
        board_state: newBoardState,
        tile_bag: remaining,
        current_player_id: nextPlayerId,
        pass_count: 0,
        updated_at: new Date().toISOString(),
      }

        const player1RackAfter = isPlayer1 ? newRack : game.player1_rack
        const player2RackAfter = isPlayer1 ? game.player2_rack : newRack

      let player1ScoreAfter = game.player1_score
      let player2ScoreAfter = game.player2_score

      if (isPlayer1) {
        player1ScoreAfter += moveScore
        gameUpdate.player1_rack = newRack
      } else {
        player2ScoreAfter += moveScore
        gameUpdate.player2_rack = newRack
      }

      const endGame = canEndGame(
        [
          { rack: player1RackAfter },
          { rack: player2RackAfter }
        ],
        remaining,
        0
      )

      if (endGame) {
        const p1Penalty = calculateEndGamePenalty(player1RackAfter)
        const p2Penalty = calculateEndGamePenalty(player2RackAfter)
        player1ScoreAfter -= p1Penalty
        player2ScoreAfter -= p2Penalty
        if (player1ScoreAfter > player2ScoreAfter) {
          player1ScoreAfter += p2Penalty
        } else if (player2ScoreAfter > player1ScoreAfter) {
          player2ScoreAfter += p1Penalty
        }
        gameUpdate.status = 'completed'
        gameUpdate.winner_id =
          player1ScoreAfter > player2ScoreAfter
            ? game.player1_id
            : player2ScoreAfter > player1ScoreAfter
              ? game.player2_id
              : null
      }

      gameUpdate.player1_score = player1ScoreAfter
      gameUpdate.player2_score = player2ScoreAfter

      // Update game in database
      const { error: gameError } = await supabase
        .from('games')
        .update(gameUpdate as any)
        .eq('id', game.id)

      if (gameError) throw gameError

      // Record the move
      const { error: moveError } = await supabase
        .from('moves')
        .insert({
          game_id: game.id,
          player_id: user.id,
          move_type: 'place_tiles',
          tiles_placed: pendingTiles as any,
          words_formed: newWords.map(w => w.word) as any,
          score_earned: moveScore,
          board_state_after: newBoardState as any,
          rack_after: newRack as any,
        })

      if (moveError) throw moveError

      setPendingTiles([])
      toast({
        title: "Move submitted!",
        description: `Hai guadagnato ${moveScore} punti`
      })

      if (endGame) {
        const mode =
          game.turn_duration === '1h' ? 'blitz'
          : game.turn_duration === '6h' ? 'rapid'
          : 'async'
        if (API_BASE) {
          fetch(`${API_BASE}/rating/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player1Id: Number(game.player1_id),
              player2Id: Number(game.player2_id),
              winnerId: gameUpdate.winner_id ? Number(gameUpdate.winner_id) : null,
              mode
            })
          }).catch(err => console.error('rating report error', err))
        }
      }

    } catch (error) {
      console.error('Error submitting move:', error)
      toast({
        title: "Error",
        description: "Unable to submit the move",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const exchangeTiles = async (indexes: number[]) => {
    if (!game || !user || !isMyTurn || indexes.length === 0) return

    if (game.tile_bag.length < indexes.length) {
      toast({
        title: 'Error',
        description: 'Not enough tiles in the bag',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)

      const isPlayer1 = game.player1_id === user.id
      const rack = isPlayer1 ? [...game.player1_rack] : [...game.player2_rack]
      const tilesToReturn: Tile[] = []

      const sorted = [...indexes].sort((a, b) => b - a)
      sorted.forEach(i => {
        const t = rack[i]
        if (t) {
          tilesToReturn.push(t)
          rack.splice(i, 1)
        }
      })

      const bagWithReturned = shuffleArray([...game.tile_bag, ...tilesToReturn])
      const { drawn, remaining } = drawTiles(bagWithReturned, indexes.length)
      const newRack = [...rack, ...drawn]

      const nextPlayerId = game.current_player_id === game.player1_id
        ? game.player2_id
        : game.player1_id

      const gameUpdate: Partial<GameRecord> = {
        tile_bag: remaining,
        current_player_id: nextPlayerId,
        pass_count: 0,
        updated_at: new Date().toISOString()
      }

      if (isPlayer1) {
        gameUpdate.player1_rack = newRack
      } else {
        gameUpdate.player2_rack = newRack
      }

      const { error: gameError } = await supabase
        .from('games')
        .update(gameUpdate as any)
        .eq('id', game.id)

      if (gameError) throw gameError

      const { error: moveError } = await supabase
        .from('moves')
        .insert({
          game_id: game.id,
          player_id: user.id,
          move_type: 'exchange_tiles',
          tiles_exchanged: tilesToReturn as any,
          score_earned: 0,
          board_state_after: game.board_state as any,
          rack_after: newRack as any
        })

      if (moveError) throw moveError

      toast({
        title: 'Tiles exchanged',
        description: `Hai scambiato ${indexes.length} tessere`
      })
    } catch (error) {
      console.error('Error exchanging tiles:', error)
      toast({
        title: 'Error',
        description: 'Unable to exchange tiles',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const passTurn = async () => {
    if (!game || !user || !isMyTurn) return

    try {
      setLoading(true)

      const nextPlayerId = game.current_player_id === game.player1_id 
        ? game.player2_id 
        : game.player1_id

      const newPassCount = (game.pass_count || 0) + 1

      const gameUpdate: Partial<GameRecord> = {
        current_player_id: nextPlayerId,
        pass_count: newPassCount,
        updated_at: new Date().toISOString()
      }

      let player1ScoreAfter = game.player1_score
      let player2ScoreAfter = game.player2_score

      const endGame = canEndGame(
        [
          { rack: game.player1_rack },
          { rack: game.player2_rack }
        ],
        game.tile_bag,
        newPassCount
      )

      if (endGame) {
        const p1Penalty = calculateEndGamePenalty(game.player1_rack)
        const p2Penalty = calculateEndGamePenalty(game.player2_rack)
        player1ScoreAfter -= p1Penalty
        player2ScoreAfter -= p2Penalty
        if (player1ScoreAfter > player2ScoreAfter) {
          player1ScoreAfter += p2Penalty
        } else if (player2ScoreAfter > player1ScoreAfter) {
          player2ScoreAfter += p1Penalty
        }
        gameUpdate.status = 'completed'
        gameUpdate.winner_id =
          player1ScoreAfter > player2ScoreAfter
            ? game.player1_id
            : player2ScoreAfter > player1ScoreAfter
              ? game.player2_id
              : null
        gameUpdate.player1_score = player1ScoreAfter
        gameUpdate.player2_score = player2ScoreAfter
      }

      await supabase
        .from('games')
        .update(gameUpdate as any)
        .eq('id', game.id)

      await supabase
        .from('moves')
        .insert({
          game_id: game.id,
          player_id: user.id,
          move_type: 'pass',
          score_earned: 0,
          board_state_after: game.board_state as any,
          rack_after: (game.player1_id === user.id ? game.player1_rack : game.player2_rack) as any
        })

      toast({
        title: "Turn passed",
        description: "You passed the turn"
      })

      if (gameUpdate.status === 'completed') {
        const mode =
          game.turn_duration === '1h' ? 'blitz'
          : game.turn_duration === '6h' ? 'rapid'
          : 'async'
        if (API_BASE) {
          fetch(`${API_BASE}/rating/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player1Id: Number(game.player1_id),
              player2Id: Number(game.player2_id),
              winnerId: gameUpdate.winner_id ? Number(gameUpdate.winner_id) : null,
              mode
            })
          }).catch(err => console.error('rating report error', err))
        }
      }

    } catch (error) {
      console.error('Error passing turn:', error)
      toast({
        title: "Error", 
        description: "Unable to pass the turn",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const surrenderGame = async () => {
    if (!game || !user) return

    try {
      setLoading(true)

      const opponentId = game.player1_id === user.id ? game.player2_id : game.player1_id

      const gameUpdate: Partial<GameRecord> = {
        status: 'completed',
        winner_id: opponentId,
        updated_at: new Date().toISOString()
      }

      await supabase
        .from('games')
        .update(gameUpdate as any)
        .eq('id', game.id)

      await supabase
        .from('moves')
        .insert({
          game_id: game.id,
          player_id: user.id,
          move_type: 'resign',
          score_earned: 0,
          board_state_after: game.board_state as any,
          rack_after: (game.player1_id === user.id ? game.player1_rack : game.player2_rack) as any
        })

      const mode =
        game.turn_duration === '1h' ? 'blitz'
        : game.turn_duration === '6h' ? 'rapid'
        : 'async'
      if (API_BASE) {
        fetch(`${API_BASE}/rating/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player1Id: Number(game.player1_id),
            player2Id: Number(game.player2_id),
            winnerId: Number(opponentId),
            mode
          })
        }).catch(err => console.error('rating report error', err))
      }

      toast({
        title: 'You surrendered',
        description: 'The opponent wins the game'
      })
    } catch (error) {
      console.error('Error surrendering game:', error)
      toast({
        title: 'Error',
        description: 'Unable to surrender the game',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getOpponentInfo = () => {
    if (!game || !user) return null

    const isPlayer1 = game.player1_id === user.id
    const opponent = isPlayer1 ? game.player2 : game.player1

    return {
      id: isPlayer1 ? game.player2_id : game.player1_id,
      name: opponent?.display_name || opponent?.username || 'Opponent',
      score: isPlayer1 ? game.player2_score : game.player1_score
    }
  }

  const getMyScore = () => {
    if (!game || !user) return 0
    return game.player1_id === user.id ? game.player1_score : game.player2_score
  }

  const getCurrentRack = () => {
    if (!game || !user) return []
    const baseRack = game.player1_id === user.id ? game.player1_rack : game.player2_rack

    // Remove tiles that are currently pending placement
    const rackCopy = [...baseRack]
    pendingTiles.forEach(tile => {
      const index = rackCopy.findIndex(r => {
        if (tile.isBlank && r.isBlank) return true
        return (
          r.letter === tile.letter &&
          r.points === tile.points &&
          r.isBlank === tile.isBlank
        )
      })
      if (index !== -1) rackCopy.splice(index, 1)
    })

    return rackCopy
  }

  return {
    game,
    gameState,
    pendingTiles,
    loading,
    isMyTurn,
    placeTile,
    pickupTile,
    submitMove,
    exchangeTiles,
    passTurn,
    surrenderGame,
    getOpponentInfo,
    getMyScore,
    getCurrentRack
  }
}