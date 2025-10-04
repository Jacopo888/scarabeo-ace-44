import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GameState, Player, Tile, PlacedTile } from '@/types/game'
import { calculateScore } from '@/utils/scoring'
import { useToast } from '@/hooks/use-toast'
import { useQuackleContext } from '@/contexts/QuackleContext'
import { useDictionary } from '@/contexts/DictionaryContext'
import type { GameMoveLite } from '@/types/localGame'
import { Difficulty } from '@/components/DifficultyModal'
import { toastOnce } from '@/lib/toastOnce'
import { sanitizeQuackleTile } from '@/lib/game/tiles'
// random shuffle handled by rack helpers
import { isCurrentPlayerTurn as isCurrentTurn } from '@/lib/game/turns'
import { getCurrentRack, reshuffleRack, withCurrentRack } from '@/lib/game/rack'
import { applyBotMove } from '@/lib/game/botMove'
import { initGameState } from '@/lib/game/init'
import { applyPassTurn } from '@/lib/game/actions'
import { applyConfirmMove } from '@/lib/game/actionsConfirm'
import { applyCancelMove } from '@/lib/game/actionsCancel'
import { applyExchangeTiles, applyExchangeSelected, applyBotExchange } from '@/lib/game/actionsExchange'
import { applyEndTurn } from '@/lib/game/actionsEndTurn'
import { applyPlaceTile } from '@/lib/game/actionsPlace'
import { applyPickupTile } from '@/lib/game/actionsPickup'
import { buildHistoryEntry, contiguousSummary } from '@/lib/game/quackleUtils'
import { titleForConfirmError } from '@/lib/game/toast'
import { shouldPassBotMove } from '@/lib/game/botPass'
import { summarizeMoveInfo } from '@/lib/game/moveUtils'
import { logPlayerMove, logPlayerAction } from '@/utils/debugLogger'
import { makeCoreConfirmDeps } from '@/core/confirmDeps'
// score unificato

  // helpers estratti in src/lib/game

export const useGame = () => {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const urlDifficulty = searchParams.get('difficulty') as Difficulty | null
  const { difficulty, setDifficulty, makeMove: quackleMakeMove } = useQuackleContext()
  const { isValidWord } = useDictionary()
  const [pendingTiles, setPendingTiles] = useState<PlacedTile[]>([])
  const [isBotTurn, setIsBotTurn] = useState(false)
  const [isSurrendered, setIsSurrendered] = useState(false)
  const [moveHistory, setMoveHistory] = useState<GameMoveLite[]>([])
  const gameIdRef = useRef<string>(crypto.randomUUID())
  const botMoveInFlightRef = useRef(false)
  
  // Legge la modalità dai parametri URL (default: local)
  const urlMode = (searchParams.get('mode') || 'local') as 'local' | 'quackle'

  // Initialize game state in base alla modalità scelta
  const initializeGameState = useCallback((): GameState => {
    console.log('[useGame] Initializing game with mode:', urlMode, 'difficulty:', difficulty)
    return initGameState(urlMode, difficulty)
  }, [difficulty, urlMode])

  // Initialize with empty state and wait for difficulty
  const [gameState, setGameState] = useState<GameState>(() => ({
    boardMatrix: Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => null)),
    players: [],
    currentPlayerIndex: 0,
    tileBag: [],
    gameStatus: 'waiting',
    gameMode: 'human',
    passCounts: [0, 0]
  }))

  const placeTile = useCallback((row: number, col: number, tile: Tile) => {
    setGameState(prev => {
      const res = applyPlaceTile(prev, row, col, tile)
      if (res.addedPending) {
        setPendingTiles(current => [...current, res.addedPending!])
      }
      return res.next
    })
  }, [])

  const pickupTile = useCallback((row: number, col: number) => {
    const idx = pendingTiles.findIndex(t => t.row === row && t.col === col)
    if (idx === -1) return
    setGameState(prev => {
      const res = applyPickupTile(prev, row, col, pendingTiles)
      if (res.didPickup) {
        setPendingTiles(current => current.filter((_, i) => i !== idx))
      }
      return res.next
    })
  }, [pendingTiles])

  const confirmMove = useCallback(() => {
  const coreDeps = makeCoreConfirmDeps(isValidWord)
  // Always use matrix scoring directly
  const deps = { 
    validateMoveLogic: coreDeps.validateMoveLogic,
    findNewWordsFormed: coreDeps.findNewWordsFormed,
    // Use matrix scoring directly (board parameter, not existingBoard)
    calculateScore: (opts: any) => calculateScore({ tiles: opts.tiles, board: opts.board || gameState.boardMatrix, context: opts.context }),
    isValidWord
  }
    setGameState(prev => {
      const res = applyConfirmMove(prev, pendingTiles, deps)
      if (!res.ok) {
        const { error, errorCode } = res
        const title = titleForConfirmError(errorCode)
        toast({ title, description: error || '', variant: 'destructive' })
        return prev
      }

    // Clear pending tiles and toast success
    setPendingTiles([])
    const { words: moveWords, score: delta } = summarizeMoveInfo(res.moveInfo)
    toast({ title: 'Move confirmed!', description: `+${delta} points for words: ${moveWords.join(', ')}` })

      // Log mossa giocatore (dev mode)
      if (import.meta.env.DEV && res.moveInfo) {
        const currentPlayer = prev.players[prev.currentPlayerIndex]
        const playerRack = getCurrentRack(prev)
        logPlayerMove(
          currentPlayer?.name || 'Player',
          playerRack,
          pendingTiles,
          moveWords,
          delta
        )
      }

  // Record move
      if (res.moveInfo) {
        setMoveHistory(prevMH => [...prevMH, { ...(res.moveInfo as any), move_index: prevMH.length + 1 }])
      }

      return res.next!
    })
  }, [pendingTiles, toast, isValidWord])

  const cancelMove = useCallback(() => {
    if (pendingTiles.length === 0) return
    setGameState(prev => applyCancelMove(prev, pendingTiles))
    setPendingTiles([])
  }, [pendingTiles])

  const reshuffleTiles = useCallback(() => {
    cancelMove()
    setGameState(prev => {
      const rack = getCurrentRack(prev)
      const shuffledRack = reshuffleRack(rack)
      return { ...prev, players: withCurrentRack(prev, shuffledRack) }
    })
  }, [cancelMove])

  const exchangeTiles = useCallback((indexes?: number[]) => {
    cancelMove()
    setGameState(prev => {
      // Log exchange (dev mode)
      if (import.meta.env.DEV) {
        const currentPlayer = prev.players[prev.currentPlayerIndex]
        const playerRack = getCurrentRack(prev)
        const count = Array.isArray(indexes) && indexes.length > 0 ? indexes.length : playerRack.length
        logPlayerAction(currentPlayer?.name || 'Player', playerRack, 'exchange', count)
      }
      if (Array.isArray(indexes) && indexes.length > 0) {
        return applyExchangeSelected(prev, indexes)
      }
      return applyExchangeTiles(prev)
    })
  }, [cancelMove])


  const passTurn = useCallback(() => {
    cancelMove()
    setGameState(prev => {
      // Log pass (dev mode)
      if (import.meta.env.DEV) {
        const currentPlayer = prev.players[prev.currentPlayerIndex]
        const playerRack = getCurrentRack(prev)
        logPlayerAction(currentPlayer?.name || 'Player', playerRack, 'pass')
      }
      return applyPassTurn(prev)
    })
  }, [cancelMove])

  const surrenderGame = useCallback(() => {
    cancelMove()
    setIsSurrendered(true)
    setGameState(prev => ({ ...prev, gameStatus: 'finished' }))
  }, [cancelMove])

  const endTurn = useCallback(() => {
    setGameState(prev => applyEndTurn(prev))
  }, [])

  const resetGame = useCallback(() => {
    console.log('[useGame] Resetting game with difficulty:', difficulty)
    const newGameState = initializeGameState()
    setGameState(newGameState)
    setPendingTiles([])
    setIsSurrendered(false)
    setMoveHistory([])
    gameIdRef.current = crypto.randomUUID()
  }, [difficulty, initializeGameState])

  // Quackle move logic
  // Single, guarded entrypoint to start the bot move. This is also used by the effect.
  const makeQuackleMove = useCallback(async () => {
    const activeDifficulty = difficulty
    if (!activeDifficulty || !quackleMakeMove) return

    // Prevent double starts
    if (botMoveInFlightRef.current || isBotTurn) return

    // Take a snapshot of the current state to avoid races with other updates
    const snapshot = gameState
    const current = snapshot.players[snapshot.currentPlayerIndex]
    if (!current?.isBot || gameState.gameStatus !== 'playing') return

    console.log('[useGame] Triggering bot move')
    botMoveInFlightRef.current = true
    setIsBotTurn(true)

    try {
  const botRack = current.rack
  const move = await quackleMakeMove(snapshot, botRack, activeDifficulty)

      console.log('[useGame] Bot move received:', move)
      console.log('[useGame] Move details - tiles:', move?.tiles?.length, 'move_type:', move?.move_type, 'engine_fallback:', move?.engine_fallback)
      
      // DEEP DEBUG: Log complete move details per indagine punteggi
      if (import.meta.env.DEV && move?.tiles) {
        console.log('[useGame] 🔍 DEEP DEBUG - Score from Quackle:', move.score)
        console.log('[useGame] 🔍 DEEP DEBUG - Tiles with coordinates:', JSON.stringify(move.tiles, null, 2))
        console.log('[useGame] 🔍 DEEP DEBUG - Words:', move.words)
      }

      // Handle explicit exchange first (exchange has no board tiles by design)
      if (move && move.move_type === 'exchange') {
        const letters = (move as any).exchange_letters as string[] | undefined
        const count = typeof (move as any).exchange_count === 'number' ? (move as any).exchange_count : (letters?.length ?? Math.min(7, getCurrentRack(snapshot).length))
        toast({ title: 'Quackle exchanged tiles', description: `Changed ${count} tile${count === 1 ? '' : 's'}.` })
        setGameState(prev => applyBotExchange(prev, letters, count))
        return
      }

      // Explicit pass
      if (!move || move.move_type === 'pass') {
        toast({ title: 'Quackle passed', description: 'No playable move this turn.' })
        passTurn()
        return
      }

      // For place moves, tiles must be present; otherwise treat as pass
      if (!move.tiles || move.tiles.length === 0) {
        toast({ title: 'Quackle passed', description: 'No playable move this turn.' })
        passTurn()
        return
      }

      let sanitizedTiles = move.tiles
        .map(sanitizeQuackleTile)
        .filter((tile): tile is PlacedTile => tile !== null)
      // Evita di includere posizioni già occupate sulla board esistente (ancoraggi/croci)
      if (sanitizedTiles.length > 0) {
        // Iterate matrix to find occupied positions
        const occupied = new Set<string>()
        for (let r = 0; r < snapshot.boardMatrix.length; r++) {
          for (let c = 0; c < snapshot.boardMatrix[r].length; c++) {
            if (snapshot.boardMatrix[r][c] !== null) {
              occupied.add(`${r},${c}`)
            }
          }
        }
        // Filter tiles that collide with existing tiles
        if (occupied.size > 0) {
          sanitizedTiles = sanitizedTiles.filter(t => !occupied.has(`${t.row},${t.col}`))
        }
      }

      // Diagnostics for continuity and bounds
      if (sanitizedTiles.length > 0) contiguousSummary(sanitizedTiles)

      if (shouldPassBotMove(move, sanitizedTiles)) {
        toast({ title: 'Quackle passed', description: 'No playable move this turn.' })
        passTurn()
        return
      }

      // Usa sempre il punteggio calcolato da Quackle (già completo, include tutti i moltiplicatori)
      const finalScore = typeof move.score === 'number' ? move.score : 0

      if (import.meta.env.DEV) {
        console.log('[useGame] 🎯 Using Quackle score:', finalScore)
      }

    // Apply bot move to game state (delegated)
  // Show all words formed (primary + cross words)
  const wordsList = (move.words && move.words.length > 0) ? move.words : []
  toast({ title: 'Quackle played!', description: `+${finalScore} with words: ${wordsList.join(', ')}` })
    const applied = applyBotMove(snapshot, { sanitizedTiles, score: finalScore, words: move.words })
  setGameState(applied.next)

      // Record move (best-effort)
      try {
        const moveInfo = buildHistoryEntry(current, sanitizedTiles, finalScore)
        setMoveHistory(prev => [...prev, { ...moveInfo, move_index: prev.length + 1 }])
      } catch {}
    } catch (error) {
      console.error('[useGame] Bot move error:', error)
      const msg = String((error as any)?.message || error)
      toastOnce(toast, 'quackle-error', msg, { title: 'Quackle error', variant: 'destructive', cooldownMs: 5000 })
    } finally {
      botMoveInFlightRef.current = false
      setIsBotTurn(false)
    }
  }, [difficulty, quackleMakeMove, gameState, isBotTurn, passTurn, toast])

  // Effect to handle Quackle turns - simplified with no circular dependencies
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    const activeDifficulty = difficulty

    console.log('[useGame] Bot turn effect:', {
      currentPlayerIndex: gameState.currentPlayerIndex,
      gameStatus: gameState.gameStatus,
      isBot: currentPlayer?.isBot,
      botThinking: isBotTurn,
      activeDifficulty: activeDifficulty
    })

    if (gameState.gameStatus === 'playing' && currentPlayer?.isBot && !isBotTurn && activeDifficulty) {
      // Delegate to the unified function (includes its own guard)
      makeQuackleMove()
    }
  }, [gameState.currentPlayerIndex, gameState.gameStatus, isBotTurn, difficulty, makeQuackleMove, passTurn])

  // Apply URL difficulty once, then rely only on `difficulty` from context
  const urlAppliedRef = useRef(false)
  useEffect(() => {
    if (!urlAppliedRef.current && urlDifficulty && urlDifficulty !== difficulty) {
      console.log('[useGame] Setting difficulty from URL (once):', urlDifficulty)
      setDifficulty(urlDifficulty)
      urlAppliedRef.current = true
    }
  }, [urlDifficulty, difficulty, setDifficulty])

  // Effect per inizializzare la modalità Quackle quando richiesto
  useEffect(() => {
    const activeDifficulty = difficulty
    if (urlMode === 'quackle' && gameState.players.length === 0) {
      console.log('[useGame] Initializing game with difficulty:', activeDifficulty)
      const newGameState = initGameState('quackle', activeDifficulty)
      console.log('[useGame] New game state players:', newGameState.players.map(p => ({ name: p.name, isBot: p.isBot })))
      console.log('[useGame] Game status set to:', newGameState.gameStatus)
      setGameState(newGameState)
      setPendingTiles([])
      setIsSurrendered(false)
      setMoveHistory([])
      gameIdRef.current = crypto.randomUUID()
    }
  }, [urlMode, difficulty, gameState.players.length])

  // Initialize Local Game (human vs human) quando mode=local
  useEffect(() => {
    if (urlMode === 'local' && gameState.players.length === 0) {
      const newState = initGameState('local', difficulty)
      console.log('[useGame] Initializing LOCAL game')
      setGameState(newState)
      setPendingTiles([])
      setIsSurrendered(false)
      setMoveHistory([])
      gameIdRef.current = crypto.randomUUID()
    }
  }, [urlMode, gameState.players.length, difficulty])

  return {
    gameState,
    pendingTiles,
    placeTile,
    pickupTile,
    confirmMove,
    cancelMove,
    resetGame,
    reshuffleTiles,
    exchangeTiles,
    passTurn,
    surrenderGame,
    makeQuackleMove,
    isBotTurn,
    isSurrendered,
    currentPlayer: gameState.players[gameState.currentPlayerIndex] || { id: '', name: '', score: 0, rack: [], isBot: false },
  isCurrentPlayerTurn: (playerId: string) => isCurrentTurn(gameState, playerId),
    moveHistory,
    gameId: gameIdRef.current
  }
}
