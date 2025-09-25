import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GameState, Player, Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
import { validateMoveLogic } from '@/utils/moveValidation'
import { findNewWordsFormed } from '@/utils/newWordFinder'
import { calculateNewMoveScore } from '@/utils/newScoring'
import { canEndGame, calculateEndGamePenalty } from '@/utils/gameRules'
import { useToast } from '@/hooks/use-toast'
import { useQuackleContext } from '@/contexts/QuackleContext'
import { useDictionary } from '@/contexts/DictionaryContext'
import type { GameMove } from './useGameAnalysis'
import { Difficulty } from '@/components/DifficultyModal'
import { toastOnce } from '@/lib/toastOnce'

  const sanitizeQuackleTile = (tile: PlacedTile): PlacedTile | null => {
    if (!tile) return null

    const rawLetter = (tile.letter ?? '').toString().trim()

    // Skip placeholder dots sent by Quackle
    if (!rawLetter || rawLetter === '.') {
      return null
    }

    const upperLetter = rawLetter.toUpperCase()
    const isBlank = tile.isBlank || upperLetter === '?'
    // Quackle restituisce coordinate 1-based: riconverti a 0-based per la nostra board.
    const rVal = typeof tile.row === 'number' ? tile.row : Number((tile as any).row || 0)
    const cVal = typeof tile.col === 'number' ? tile.col : Number((tile as any).col || 0)
    const row = Math.max(rVal - 1, 0)
    const col = Math.max(cVal - 1, 0)

    return {
      ...tile,
      letter: upperLetter,
      isBlank,
      points: isBlank ? 0 : (Number(tile.points) || 0),
      row,
      col
    }
  }

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const drawTiles = (bag: Tile[], count: number): { drawn: Tile[], remaining: Tile[] } => {
  const drawn = bag.slice(0, count)
  const remaining = bag.slice(count)
  return { drawn, remaining }
}

export const useGame = () => {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const urlDifficulty = searchParams.get('difficulty') as Difficulty | null
  const { difficulty, setDifficulty, makeMove: quackleMakeMove } = useQuackleContext()
  const { isValidWord } = useDictionary()
  const [pendingTiles, setPendingTiles] = useState<PlacedTile[]>([])
  const [isBotTurn, setIsBotTurn] = useState(false)
  const [isSurrendered, setIsSurrendered] = useState(false)
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([])
  const gameIdRef = useRef<string>(crypto.randomUUID())
  const botMoveInFlightRef = useRef(false)
  
  // Initialize game state with proper bot mode detection
  const initializeGameState = useCallback((): GameState => {
    console.log('[useGame] Initializing game with difficulty:', difficulty)
    const shuffledBag = shuffleArray(TILE_DISTRIBUTION)
    const player1Tiles = drawTiles(shuffledBag, 7)
    const player2Tiles = drawTiles(player1Tiles.remaining, 7)

    const gameMode: 'human' | 'quackle' = difficulty ? 'quackle' : 'human'
    const startingPlayerIndex = Math.floor(Math.random() * 2)

    return {
      board: new Map(),
      players: [
        {
          id: 'player1',
          name: difficulty ? 'You' : 'Player 1',
          score: 0,
          rack: player1Tiles.drawn,
          isBot: false
        },
        {
          id: 'player2',
          name: difficulty ? `Quackle (${difficulty})` : 'Player 2',
          score: 0,
          rack: player2Tiles.drawn,
          isBot: !!difficulty
        }
      ],
      currentPlayerIndex: startingPlayerIndex,
      tileBag: player2Tiles.remaining,
      gameStatus: difficulty ? 'playing' : 'waiting',
      gameMode,
      passCounts: [0, 0]
    }
  }, [difficulty])

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
    const key = `${row},${col}`
    
    setGameState(prev => {
      if (prev.board.has(key)) return prev // Square already occupied
      
      // Remove tile from current player's rack
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      const tileIndex = currentPlayer.rack.findIndex(t => {
        if (tile.isBlank && t.isBlank) return true
        return t.letter === tile.letter && t.points === tile.points && t.isBlank === tile.isBlank
      })
      
      if (tileIndex === -1) return prev // Tile not found in rack
      
      const newRack = [...currentPlayer.rack]
      newRack.splice(tileIndex, 1)
      
      const newPlayers = [...prev.players]
      newPlayers[prev.currentPlayerIndex] = {
        ...currentPlayer,
        rack: newRack
      }
      
      // Add to pending tiles instead of board
      const newTile: PlacedTile = { ...tile, row, col }
      setPendingTiles(current => [...current, newTile])
      
      return {
        ...prev,
        players: newPlayers
      }
    })
  }, [])

  const pickupTile = useCallback((row: number, col: number) => {
    const key = `${row},${col}`
    
    // Check if tile is in pending tiles (can only pick up tiles from current turn)
    const tileIndex = pendingTiles.findIndex(t => t.row === row && t.col === col)
    if (tileIndex === -1) return // Tile not found in pending tiles
    
    const tile = pendingTiles[tileIndex]
    const returnedTile = tile.isBlank ? { ...tile, letter: '' } : tile

    setGameState(prev => {
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      const newPlayers = [...prev.players]
      newPlayers[prev.currentPlayerIndex] = {
        ...currentPlayer,
        rack: [...currentPlayer.rack, returnedTile]
      }
      
      return {
        ...prev,
        players: newPlayers
      }
    })
    
    // Remove from pending tiles
    setPendingTiles(current => current.filter((_, i) => i !== tileIndex))
  }, [pendingTiles])

  const confirmMove = useCallback(() => {
    if (pendingTiles.length === 0) {
      toast({
        title: "Error",
        description: "No tiles to confirm",
        variant: "destructive"
      })
      return
    }

    let moveInfo: Omit<GameMove, 'move_index'> | null = null

    setGameState(prev => {
      // Validate the move using new logic
      const validation = validateMoveLogic(prev.board, pendingTiles)

      if (!validation.isValid) {
        toast({
          title: "Invalid move",
          description: validation.errors.join(', '),
          variant: "destructive"
        })
        return prev
      }

      // Find only the new words formed by this move
      const newWords = findNewWordsFormed(prev.board, pendingTiles)

      // Validate all new words in dictionary
      const invalidWords = newWords.filter(word => !isValidWord(word.word))
      if (invalidWords.length > 0) {
        toast({
          title: "Invalid words",
          description: `Invalid words: ${invalidWords.map(w => w.word).join(', ')}`,
          variant: "destructive"
        })
        return prev
      }

      // Calculate score only for new words
      const score = calculateNewMoveScore(newWords, pendingTiles)

      // Add tiles to board
      const newBoard = new Map(prev.board)
      pendingTiles.forEach(tile => {
        const key = `${tile.row},${tile.col}`
        newBoard.set(key, tile)
      })

      // Update player score and rack
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      const tilesNeeded = 7 - currentPlayer.rack.length

      // Draw new tiles
      const { drawn, remaining } = tilesNeeded > 0 && prev.tileBag.length > 0
        ? drawTiles(prev.tileBag, Math.min(tilesNeeded, prev.tileBag.length))
        : { drawn: [], remaining: prev.tileBag }

      const newPlayers = [...prev.players]
      newPlayers[prev.currentPlayerIndex] = {
        ...currentPlayer,
        score: currentPlayer.score + score,
        rack: [...currentPlayer.rack, ...drawn]
      }

      // Prepare move info for analysis
      const rackBefore = [...currentPlayer.rack, ...pendingTiles]
      const row = Math.min(...pendingTiles.map(t => t.row))
      const col = Math.min(...pendingTiles.map(t => t.col))
      const dir = pendingTiles.every(t => t.row === pendingTiles[0].row) ? 'H' : 'V'
      moveInfo = {
        word: newWords[0]?.word || '',
        score_earned: score,
        rack_before: rackBefore,
        player_id: currentPlayer.id,
        row,
        col,
        dir
      }

      // Clear pending tiles
      setPendingTiles([])

      toast({
        title: "Move confirmed!",
        description: `+${score} points for words: ${newWords.map(w => w.word).join(', ')}`
      })

      const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
      newPassCounts[prev.currentPlayerIndex] = 0
      const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length
      const endGame = canEndGame(
        newPlayers.map(p => ({ rack: p.rack })),
        remaining
      )

      if (endGame) {
        const p1Penalty = calculateEndGamePenalty(newPlayers[0].rack)
        const p2Penalty = calculateEndGamePenalty(newPlayers[1].rack)
        let p1Score = newPlayers[0].score - p1Penalty
        let p2Score = newPlayers[1].score - p2Penalty
        if (p1Score > p2Score) p1Score += p2Penalty
        else if (p2Score > p1Score) p2Score += p1Penalty
        const finalPlayers: Player[] = [
          { ...newPlayers[0], score: p1Score },
          { ...newPlayers[1], score: p2Score }
        ]
        return {
          ...prev,
          board: newBoard,
          players: finalPlayers,
          tileBag: remaining,
          gameStatus: 'finished',
          passCounts: newPassCounts,
          lastMove: pendingTiles
        }
      }

      // Automatically end turn after successful move
      return {
        ...prev,
        board: newBoard,
        players: newPlayers,
        tileBag: remaining,
        currentPlayerIndex: nextPlayerIndex,
        passCounts: newPassCounts,
        lastMove: pendingTiles
      }
    })

    if (moveInfo) {
      setMoveHistory(prev => [...prev, { ...moveInfo!, move_index: prev.length + 1 }])
    }
  }, [pendingTiles, toast, isValidWord])

  const cancelMove = useCallback(() => {
    if (pendingTiles.length === 0) return
    
    setGameState(prev => {
      // Return tiles to current player's rack
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      const newPlayers = [...prev.players]
      newPlayers[prev.currentPlayerIndex] = {
        ...currentPlayer,
        rack: [...currentPlayer.rack, ...pendingTiles]
      }
      
      setPendingTiles([])
      
      return {
        ...prev,
        players: newPlayers
      }
    })
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
    setGameState(prev => {
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      const rackSize = currentPlayer.rack.length

      if (prev.tileBag.length < rackSize) return prev

      const bagWithReturned = shuffleArray([...prev.tileBag, ...currentPlayer.rack])
      const { drawn, remaining } = drawTiles(bagWithReturned, rackSize)

      const newPlayers = [...prev.players]
      newPlayers[prev.currentPlayerIndex] = {
        ...currentPlayer,
        rack: drawn
      }

      const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
      newPassCounts[prev.currentPlayerIndex] = 0
      return {
        ...prev,
        players: newPlayers,
        tileBag: remaining,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
        passCounts: newPassCounts
      }
    })
  }, [cancelMove])


  const passTurn = useCallback(() => {
    cancelMove()
    setGameState(prev => {
      const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
      newPassCounts[prev.currentPlayerIndex] += 1
      const totalPasses = newPassCounts.reduce((sum, c) => sum + c, 0)
      const endGame = canEndGame(
        prev.players.map(p => ({ rack: p.rack })),
        prev.tileBag,
        totalPasses
      )

      if (endGame) {
        const p1Penalty = calculateEndGamePenalty(prev.players[0].rack)
        const p2Penalty = calculateEndGamePenalty(prev.players[1].rack)
        let p1Score = prev.players[0].score - p1Penalty
        let p2Score = prev.players[1].score - p2Penalty
        if (p1Score > p2Score) p1Score += p2Penalty
        else if (p2Score > p1Score) p2Score += p1Penalty
        const finalPlayers: Player[] = [
          { ...prev.players[0], score: p1Score },
          { ...prev.players[1], score: p2Score }
        ]
        return {
          ...prev,
          players: finalPlayers,
          gameStatus: 'finished',
          passCounts: newPassCounts
        }
      }

      return {
        ...prev,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
        passCounts: newPassCounts
      }
    })
  }, [cancelMove])

  const surrenderGame = useCallback(() => {
    cancelMove()
    setIsSurrendered(true)
    setGameState(prev => ({ ...prev, gameStatus: 'finished' }))
  }, [cancelMove])

  const endTurn = useCallback(() => {
    setGameState(prev => {
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      const tilesNeeded = 7 - currentPlayer.rack.length
      
      const { drawn, remaining } =
        tilesNeeded > 0 && prev.tileBag.length > 0
          ? drawTiles(prev.tileBag, Math.min(tilesNeeded, prev.tileBag.length))
          : { drawn: [], remaining: prev.tileBag }

      const newPlayers = [...prev.players]
      newPlayers[prev.currentPlayerIndex] = {
        ...currentPlayer,
        rack: [...currentPlayer.rack, ...drawn]
      }

      const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
      newPassCounts[prev.currentPlayerIndex] = 0
      const endGame = canEndGame(
        newPlayers.map(p => ({ rack: p.rack })),
        remaining
      )

      if (endGame) {
        const p1Penalty = calculateEndGamePenalty(newPlayers[0].rack)
        const p2Penalty = calculateEndGamePenalty(newPlayers[1].rack)
        let p1Score = newPlayers[0].score - p1Penalty
        let p2Score = newPlayers[1].score - p2Penalty
        if (p1Score > p2Score) p1Score += p2Penalty
        else if (p2Score > p1Score) p2Score += p1Penalty
        const finalPlayers: Player[] = [
          { ...newPlayers[0], score: p1Score },
          { ...newPlayers[1], score: p2Score }
        ]
        return {
          ...prev,
          players: finalPlayers,
          tileBag: remaining,
          gameStatus: 'finished',
          passCounts: newPassCounts
        }
      }

      return {
        ...prev,
        players: newPlayers,
        tileBag: remaining,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
        passCounts: newPassCounts
      }
    })
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

    const current = gameState.players[gameState.currentPlayerIndex]
    if (!current?.isBot || gameState.gameStatus !== 'playing') return

    console.log('[useGame] Triggering bot move')
    botMoveInFlightRef.current = true
    setIsBotTurn(true)

    try {
      const botRack = current.rack
      const move = await quackleMakeMove(gameState, botRack, activeDifficulty)

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

      // Apply bot move to game state
      setGameState(prev => {
        const newBoard = new Map(prev.board)
        sanitizedTiles.forEach(tile => {
          const key = `${tile.row},${tile.col}`
          newBoard.set(key, {
            letter: tile.letter,
            points: tile.points,
            row: tile.row,
            col: tile.col,
            isBlank: tile.isBlank || false
          })
        })

        // Update bot rack and score
        const currentPlayer = prev.players[prev.currentPlayerIndex]
        const newRack = [...currentPlayer.rack]
        sanitizedTiles.forEach(usedTile => {
          const tileIndex = newRack.findIndex(t => {
            if (usedTile.isBlank && t.isBlank) return true
            return (t.letter || '').toUpperCase() === usedTile.letter && t.points === usedTile.points
          })
          if (tileIndex !== -1) newRack.splice(tileIndex, 1)
        })

        const tilesNeeded = 7 - newRack.length
        const { drawn, remaining } = tilesNeeded > 0 && prev.tileBag.length > 0
          ? drawTiles(prev.tileBag, Math.min(tilesNeeded, prev.tileBag.length))
          : { drawn: [], remaining: prev.tileBag }

        const newPlayers = [...prev.players]
        newPlayers[prev.currentPlayerIndex] = {
          ...currentPlayer,
          score: currentPlayer.score + move.score,
          rack: [...newRack, ...drawn]
        }

        const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
        newPassCounts[prev.currentPlayerIndex] = 0

        toast({ title: 'Quackle played!', description: `Quackle scored ${move.score} points with: ${move.words.join(', ')}` })

        return {
          ...prev,
          board: newBoard,
          players: newPlayers,
          tileBag: remaining,
          currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
          passCounts: newPassCounts,
          lastMove: sanitizedTiles
        }
      })

      // Record move for analysis (best-effort)
      try {
        const isHorizontal = sanitizedTiles.every(t => t.row === sanitizedTiles[0].row)
        const ordered = [...sanitizedTiles].sort((a, b) => isHorizontal ? a.col - b.col : a.row - b.row)
        const placedString = ordered.map(t => t.letter).join('')
        const row = Math.min(...sanitizedTiles.map(t => t.row))
        const col = Math.min(...sanitizedTiles.map(t => t.col))
        const moveInfo: Omit<GameMove, 'move_index'> = {
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

  // Effect to initialize game when difficulty is available (idempotent)
  useEffect(() => {
    const activeDifficulty = difficulty
    console.log('[useGame] Active difficulty:', activeDifficulty)
    if (activeDifficulty && gameState.players.length === 0) {
      console.log('[useGame] Initializing game with difficulty:', activeDifficulty)
      
      // Initialize game state directly here to avoid circular dependency
      const shuffledBag = shuffleArray(TILE_DISTRIBUTION)
      const player1Tiles = drawTiles(shuffledBag, 7)
      const player2Tiles = drawTiles(player1Tiles.remaining, 7)

      const gameMode: 'human' | 'quackle' = 'quackle'
      const startingPlayerIndex = Math.floor(Math.random() * 2)

      const newGameState: GameState = {
        board: new Map(),
        players: [
          {
            id: 'player1',
            name: 'You',
            score: 0,
            rack: player1Tiles.drawn,
            isBot: false
          },
          {
            id: 'player2',
            name: `Quackle (${activeDifficulty})`,
            score: 0,
            rack: player2Tiles.drawn,
            isBot: true
          }
        ],
        currentPlayerIndex: startingPlayerIndex,
        tileBag: player2Tiles.remaining,
        gameStatus: 'playing',
        gameMode,
        passCounts: [0, 0]
      }
      
      console.log('[useGame] New game state players:', newGameState.players.map(p => ({ name: p.name, isBot: p.isBot })))
      console.log('[useGame] Game status set to:', newGameState.gameStatus)
      setGameState(newGameState)
      setPendingTiles([])
      setIsSurrendered(false)
      setMoveHistory([])
      gameIdRef.current = crypto.randomUUID()
    }
  }, [difficulty, gameState.players.length])

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
