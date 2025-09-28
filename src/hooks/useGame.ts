import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GameState, Player, Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
import { validateMoveLogic } from '@/utils/moveValidation'
import { findNewWordsFormed } from '@/utils/newWordFinder'
import { calculateNewMoveScore } from '@/utils/newScoring'
import { canEndGame } from '@/utils/gameRules'
import { useToast } from '@/hooks/use-toast'
import { useQuackleContext } from '@/contexts/QuackleContext'
import { useDictionary } from '@/contexts/DictionaryContext'
type GameMoveLite = {
  move_index: number
  word: string | null
  score_earned: number
  rack_before: any[]
  player_id: string
  row?: number
  col?: number
  dir?: 'H' | 'V'
}
import { Difficulty } from '@/components/DifficultyModal'
import { toastOnce } from '@/lib/toastOnce'
import { sanitizeQuackleTile } from '@/lib/game/tiles'
import { shuffleArray, drawTiles } from '@/lib/game/random'
import { applyBotMove } from '@/lib/game/botMove'
import { initGameState } from '@/lib/game/init'
import { applyPassTurn } from '@/lib/game/actions'
import { applyConfirmMove } from '@/lib/game/actionsConfirm'
import { applyCancelMove } from '@/lib/game/actionsCancel'
import { applyExchangeTiles } from '@/lib/game/actionsExchange'
import { applyEndTurn } from '@/lib/game/actionsEndTurn'
import { applyPlaceTile } from '@/lib/game/actionsPlace'
import { applyPickupTile } from '@/lib/game/actionsPickup'

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
    board: new Map(),
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
    const deps = { validateMoveLogic, findNewWordsFormed, calculateNewMoveScore, isValidWord }
    setGameState(prev => {
      const res = applyConfirmMove(prev, pendingTiles, deps)
      if (!res.ok) {
        const { error, errorCode } = res
        const title = errorCode === 'empty' ? 'Error' : errorCode === 'invalid_move' ? 'Invalid move' : 'Invalid words'
        toast({ title, description: error || '', variant: 'destructive' })
        return prev
      }

      // Clear pending tiles and toast success
      setPendingTiles([])
  const moveWords = res.moveInfo?.words ?? (res.moveInfo?.word ? [res.moveInfo.word] : [])
      const delta = res.moveInfo?.score_earned ?? 0
      toast({ title: 'Move confirmed!', description: `+${delta} points for words: ${moveWords.join(', ')}` })

      // Record move for analysis
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
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      const shuffledRack = shuffleArray([...currentPlayer.rack])
      
      const newPlayers = [...prev.players]
      newPlayers[prev.currentPlayerIndex] = {
        ...currentPlayer,
        rack: shuffledRack
      }
      
      return {
        ...prev,
        players: newPlayers
      }
    })
  }, [cancelMove])

  const exchangeTiles = useCallback(() => {
    cancelMove()
    setGameState(prev => applyExchangeTiles(prev))
  }, [cancelMove])


  const passTurn = useCallback(() => {
    cancelMove()
    setGameState(prev => applyPassTurn(prev))
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

      if (!move || move.move_type === 'pass' || !move.tiles || move.tiles.length === 0) {
        passTurn()
        return
      }

      const sanitizedTiles = move.tiles
        .map(sanitizeQuackleTile)
        .filter((tile): tile is PlacedTile => tile !== null)

      // Diagnostics for continuity and bounds
      if (sanitizedTiles.length > 0) {
        const rows = sanitizedTiles.map(t => t.row)
        const cols = sanitizedTiles.map(t => t.col)
        const isH = sanitizedTiles.every(t => t.row === sanitizedTiles[0].row)
        const ordered = [...sanitizedTiles].sort((a,b)=> isH ? a.col - b.col : a.row - b.row)
        const contiguous = ordered.every((t,i,arr) => i===0 || (isH ? t.col === arr[i-1].col + 1 : t.row === arr[i-1].row + 1))
        // eslint-disable-next-line no-console
        console.log('[useGame] sanitize summary:', { count: sanitizedTiles.length, minRow: Math.min(...rows), maxRow: Math.max(...rows), minCol: Math.min(...cols), maxCol: Math.max(...cols), isH, contiguous })
        if (!contiguous) {
          // eslint-disable-next-line no-console
          console.warn('[useGame] Non-contiguous bot tiles after sanitize; check indexing or anchor handling.', ordered)
        }
      }

      if (sanitizedTiles.length === 0) {
        passTurn()
        return
      }

      // Apply bot move to game state (delegated)
  toast({ title: 'Quackle played!', description: `Quackle scored ${move.score} points with: ${move.words.join(', ')}` })
  const applied = applyBotMove(snapshot, { sanitizedTiles, score: move.score, words: move.words })
  setGameState(applied.next)

      // Record move for analysis (best-effort)
      try {
        const isHorizontal = sanitizedTiles.every(t => t.row === sanitizedTiles[0].row)
        const ordered = [...sanitizedTiles].sort((a, b) => isHorizontal ? a.col - b.col : a.row - b.row)
        const placedString = ordered.map(t => t.letter).join('')
        const row = Math.min(...sanitizedTiles.map(t => t.row))
        const col = Math.min(...sanitizedTiles.map(t => t.col))
  const moveInfo: Omit<GameMoveLite, 'move_index'> = {
          word: placedString,
          score_earned: move.score,
          rack_before: current.rack,
          player_id: current.id,
          row,
          col,
          dir: isHorizontal ? 'H' : 'V'
        }
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
    isCurrentPlayerTurn: (playerId: string) => gameState.players[gameState.currentPlayerIndex]?.id === playerId,
    moveHistory,
    gameId: gameIdRef.current
  }
}
