import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { GameRecord, MoveRecord } from '@/types/multiplayer'
import { GameState, Tile, PlacedTile } from '@/types/game'
import { useToast } from '@/hooks/use-toast'
import { validateMoveLogic } from '@/utils/moveValidation'
import { findNewWordsFormed } from '@/utils/newWordFinder'
import { calculateScore } from '@/utils/scoring'
import { shuffleArray, drawTiles } from '@/lib/multiplayer/tiles'
import { shouldEndGameAfterMove, applyEndgamePenalties } from '@/lib/multiplayer/endgame'
import { useDictionary } from '@/contexts/DictionaryContext'
import { buildGameState } from '@/lib/multiplayer/state'
import { fetchGameWithProfiles, submitMoveForGame, exchangeTilesForGame, passTurnForGame, surrenderGameForGame } from '@/services/multiplayer'
import { reportGameResult } from '@/services/rating'
import { getOpponentInfo as _getOpponentInfo, getMyScore as _getMyScore, getCurrentRack as _getCurrentRack } from '@/lib/multiplayer/selectors'
import { computeValidatedMove, applyPendingTilesToBoard } from '@/lib/multiplayer/moveUtils'
import { upsertPendingTile, removePendingTile } from '@/lib/multiplayer/pending'
import { prepareSubmitOutcome } from '@/lib/multiplayer/prepare'

const API_BASE = import.meta.env.VITE_RATING_API_URL || (import.meta.env.MODE === 'development' ? '/api' : '')

// moved to lib/multiplayer/tiles

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
      // Removed 'moves' INSERT subscription; games UPDATE is sufficient to refresh state
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, user, game?.current_player_id])

  const fetchGame = async () => {
    if (!gameId || !user) return

    try {
      const data = await fetchGameWithProfiles(gameId)
      setGame(data)
      updateGameState(data)
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
    const { state, isMyTurn } = buildGameState(gameData, user.id)
    setGameState(state)
    setIsMyTurn(isMyTurn)
  }

  const placeTile = useCallback((row: number, col: number, tile: Tile) => {
    if (!isMyTurn) return
    setPendingTiles(prev => upsertPendingTile(prev, row, col, tile))
  }, [isMyTurn])

  const pickupTile = useCallback((row: number, col: number) => {
    setPendingTiles(prev => removePendingTile(prev, row, col))
  }, [])

  // calculatePrimaryWord now imported from lib/multiplayer/utils

  // getNextMoveIndex removed; we can compute next index client-side when needed if we fetch last move
  const submitMove = async () => {

    try {
      setLoading(true)

      // Prepare board and compute validated move via pure helpers
      const boardMap = new Map<string, PlacedTile>(Object.entries(game.board_state || {}) as [string, PlacedTile][])
  const prepared = prepareSubmitOutcome(boardMap, pendingTiles, { validateMoveLogic, findNewWordsFormed, calculateScore, isValidWord })
      if (!prepared.ok) {
        const errs = (prepared as { ok: false; errors: string[] }).errors || []
        toast({ title: 'Invalid move', description: errs.join(', '), variant: 'destructive' })
        setLoading(false)
        return
      }
      const moveScore = prepared.score
      const newWords = prepared.words
      const newBoardState = prepared.newBoardState as any

      // Remove used tiles from rack more carefully to prevent duplicates
      const { endGame, winnerId } = await submitMoveForGame({
        game,
        userId: user.id,
        pendingTiles,
        newBoardState: newBoardState as any,
        moveScore,
        words: newWords
      })

      setPendingTiles([])
  toast({ title: "Move submitted!", description: `Hai guadagnato ${moveScore} punti` })

      if (endGame) {
        reportGameResult(game, winnerId).catch(() => {})
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

      await exchangeTilesForGame({ game, userId: user.id, indexes })

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

  const { endGame, winnerId } = await passTurnForGame({ game, userId: user.id })

      toast({
        title: "Turn passed",
        description: "You passed the turn"
      })

      if (endGame) {
        reportGameResult(game, winnerId).catch(() => {})
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

  const { winnerId } = await surrenderGameForGame({ game, userId: user.id })

      reportGameResult(game, winnerId).catch(() => {})

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

  const getOpponentInfo = () => (game && user ? _getOpponentInfo(game, user.id) : null)

  const getMyScore = () => (game && user ? _getMyScore(game, user.id) : 0)

  const getCurrentRack = () => (game && user ? _getCurrentRack(game, user.id, pendingTiles) : [])

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
