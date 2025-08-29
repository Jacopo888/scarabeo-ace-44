import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Timer, Trophy, Zap, Check, X, Calendar } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useCountdown } from '@/hooks/useCountdown'
import { useDictionary } from '@/contexts/DictionaryContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { ScrabbleBoard } from '@/components/ScrabbleBoard'
import { TileRack } from '@/components/TileRack'
import { PuzzleTopMoves } from '@/components/PuzzleTopMoves'
import { PuzzleLeaderboard } from '@/components/PuzzleLeaderboard'
import { BlankTileDialog } from '@/components/BlankTileDialog'
import { usePuzzlePuzzle } from '@/hooks/usePuzzle'
import { submitPuzzleScore } from '@/api/puzzle'
import { generateLocal15x15Puzzle, getTopMovesForBoard } from '@/utils/puzzleGenerator15x15'
import { validateMoveLogic } from '@/utils/moveValidation'
import { findNewWordsFormed } from '@/utils/newWordFinder'
import { calculateNewMoveScore } from '@/utils/newScoring'
import { useIsMobile } from '@/hooks/use-mobile'
import { Tile, PlacedTile } from '@/types/game'
import { Tile as StoreTile } from '@/store/game'
import { Puzzle, PuzzleMove, PuzzleGameState } from '@/types/puzzle'
import { DailyPuzzle } from '@/types/daily'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

function getMoveKey(move: PuzzleMove): string {
  const sortedTiles = [...move.tiles].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  return sortedTiles.map(t => `${t.row},${t.col},${t.letter}`).join('|')
}

function createMovesFromTiles(tiles: PlacedTile[]): PuzzleMove {
  const sortedTiles = [...tiles].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  return {
    tiles: sortedTiles,
    words: [], // Will be filled during validation
    score: 0   // Will be calculated during validation
  }
}

const PuzzleGame = () => {
  const location = useLocation()
  const [isDailyMode, setIsDailyMode] = useState(false)
  const [gameState, setGameState] = useState<PuzzleGameState>({
    puzzle: null,
    foundMoves: new Set(),
    pendingTiles: [],
    remainingRack: [],
    isGameOver: false,
    totalScore: 0,
    hints: {
      currentMoveIndex: 0,
      anchorRevealed: false,
      lengthRevealed: false,
      lettersRevealed: false
    }
  })
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null)
  const [blankTile, setBlankTile] = useState<{ row: number, col: number, tile: Tile } | null>(null)
  const [initialBoard, setInitialBoard] = useState<Map<string, PlacedTile>>(new Map())
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string | null>(null)
  const [showSubmissionError, setShowSubmissionError] = useState(false)
  const [submissionError, setSubmissionError] = useState<string>('')
  const [isRefetching, setIsRefetching] = useState(false)
  
  const { timeLeft, isRunning, start, stop, formatTime } = useCountdown()
  const { isValidWord, isLoaded: isDictionaryLoaded } = useDictionary()
  const { user } = useAuth()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const { data: apiPuzzle, error: puzzleError, mutate: refetchPuzzle } = usePuzzlePuzzle()

  const initializePuzzle = useCallback((puzzle: Puzzle) => {
    // Convert board array to Map for efficient lookups
    const boardMap = new Map<string, PlacedTile>()
    puzzle.board.forEach(tile => {
      boardMap.set(`${tile.row},${tile.col}`, tile)
    })
    
    // Defer heavy top-move generation; initialize with empty topMoves
    const finalPuzzle = puzzle
    
    setInitialBoard(boardMap)
    setGameState({
      puzzle: finalPuzzle,
      foundMoves: new Set(),
      pendingTiles: [],
      remainingRack: [...finalPuzzle.rack],
      isGameOver: false,
      totalScore: 0,
      hints: {
        currentMoveIndex: 0,
        anchorRevealed: false,
        lengthRevealed: false,
        lettersRevealed: false
      }
    })
    start(90) // 90 seconds
  }, [start])

  const submitDailyScore = async (score: number) => {
    try {
      const today = new Date()
      const utc = new Date(today.getTime() + today.getTimezoneOffset() * 60000)
      const yyyymmdd = utc.getFullYear() * 10000 + (utc.getMonth() + 1) * 100 + utc.getDate()
      
      const userId = user?.id || `anon-${Date.now()}`
      
      if (!user) {
        localStorage.setItem(`daily:${yyyymmdd}:played`, 'true')
        localStorage.setItem(`daily:${yyyymmdd}:score`, score.toString())
      }

      await supabase.from('daily_scores').upsert({
        user_id: userId,
        yyyymmdd,
        score
      }, { onConflict: 'user_id,yyyymmdd' })
    } catch (error) {
      console.error('Error submitting daily score:', error)
    }
  }

  const endGame = useCallback(async () => {
    if (!gameState.puzzle || gameState.isGameOver) return
    
    setGameState(prev => ({ ...prev, isGameOver: true }))

    if (isDailyMode) {
      await submitDailyScore(gameState.totalScore)
      toast({
        title: "Daily Challenge Complete!",
        description: `Your score of ${gameState.totalScore} points has been recorded.`,
        variant: "default"
      })
    } else if (user && currentPuzzleId) {
      try {
        await submitPuzzleScore({
          puzzleId: currentPuzzleId,
          userId: user.id,
          score: gameState.totalScore
        })
        
        toast({
          title: "Score Submitted!",
          description: `Your score of ${gameState.totalScore} points has been recorded.`,
          variant: "default"
        })
      } catch (error) {
        console.error('Error submitting score:', error)
        setSubmissionError(error instanceof Error ? error.message : 'Failed to submit score')
        setShowSubmissionError(true)
      }
    }
  }, [gameState, isDailyMode, user, currentPuzzleId, toast, submitDailyScore])

  // Check for daily mode
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const isDaily = searchParams.get('daily') === 'true'
    setIsDailyMode(isDaily)

    if (isDaily && isDictionaryLoaded) {
      const dailyPuzzleData = sessionStorage.getItem('daily-puzzle')
      if (dailyPuzzleData) {
        const dailyPuzzle: DailyPuzzle = JSON.parse(dailyPuzzleData)
        const puzzleData: Puzzle = {
          id: dailyPuzzle.id,
          board: dailyPuzzle.board,
          rack: dailyPuzzle.rack,
          topMoves: []
        }
        initializePuzzle(puzzleData)
      }
    }
  }, [location, isDictionaryLoaded, initializePuzzle])

  useEffect(() => {
    if (isDailyMode) return

    if (apiPuzzle) {
      const puzzle: Puzzle = {
        id: apiPuzzle.puzzleId,
        board: apiPuzzle.board,
        rack: apiPuzzle.rack,
        topMoves: []
      }
      initializePuzzle(puzzle)
      setCurrentPuzzleId(apiPuzzle.puzzleId)
      setIsRefetching(false)
    } else if (puzzleError && isDictionaryLoaded) {
      // Use light mode and fewer simulation turns to avoid heavy CPU usage
      const localPuzzle = generateLocal15x15Puzzle(isValidWord, isDictionaryLoaded, true, 1)
      initializePuzzle(localPuzzle)
      setCurrentPuzzleId(null)
      setIsRefetching(false)

      toast({
        title: "Playing Offline",
        description: "Using local puzzle generation. Scores won't be saved.",
        variant: "default"
      })
    }
  }, [apiPuzzle, puzzleError, isDictionaryLoaded, isDailyMode, initializePuzzle, isValidWord, toast])

  useEffect(() => {
    // Cleanup timer on unmount to prevent zombie timers
    return () => {
      stop()
    }
  }, [stop])

  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      endGame()
    }
  }, [timeLeft, isRunning, endGame])

  // Defer top moves generation until after initial render to prevent blocking
  useEffect(() => {
    if (!gameState.puzzle) return
    if (gameState.puzzle.topMoves.length > 0) return
    if (!isDictionaryLoaded) return

    // Generate in a microtask so the UI can paint
    const id = setTimeout(() => {
      const localTopMoves = getTopMovesForBoard(initialBoard, gameState.puzzle!.rack, isValidWord, isDictionaryLoaded)
      setGameState(prev => {
        if (!prev.puzzle) return prev
        // If already filled, skip
        if (prev.puzzle.topMoves.length > 0) return prev
        const updated = {
          ...prev,
          puzzle: {
            ...prev.puzzle,
            topMoves: localTopMoves
          }
        }
        return updated
      })
    }, 0)
    return () => clearTimeout(id)
  }, [gameState.puzzle, isDictionaryLoaded, isValidWord, initialBoard])

  const resetAndRefetch = async () => {
    if (isRefetching) return
    
    setIsRefetching(true)
    stop() // Stop current timer
    
    // Reset game state immediately
    setGameState({
      puzzle: null,
      foundMoves: new Set(),
      pendingTiles: [],
      remainingRack: [],
      isGameOver: false,
      totalScore: 0,
      hints: {
        currentMoveIndex: 0,
        anchorRevealed: false,
        lengthRevealed: false,
        lettersRevealed: false
      }
    })
    setSelectedTileIndex(null)
    setCurrentPuzzleId(null)
    
    try {
      await refetchPuzzle()
    } catch (error) {
      // If refetch fails, generate local puzzle immediately
      if (isDictionaryLoaded) {
        const localPuzzle = generateLocal15x15Puzzle(isValidWord, isDictionaryLoaded, false, 6)
        initializePuzzle(localPuzzle)
        setCurrentPuzzleId(null)
        setIsRefetching(false)
        
        toast({
          title: "Using Local Puzzle",
          description: "API unavailable, generated offline puzzle",
          variant: "default"
        })
      }
    }
  }

  const handleTileSelect = (index: number) => {
    if (gameState.isGameOver) return
    setSelectedTileIndex(selectedTileIndex === index ? null : index)
  }

  const handleTileDragStart = (index: number, tile: Tile) => {
    // Drag start handled by TileRack component
  }

  const handlePlaceTile = (row: number, col: number, tile: StoreTile | Tile) => {
    if (gameState.isGameOver) return

    // Convert StoreTile to GameTile if needed
    const gameTile: Tile = 'value' in tile && !('points' in tile)
      ? { letter: tile.letter, points: Number(tile.value), isBlank: Boolean('isBlank' in tile ? tile.isBlank : false) }
      : tile as Tile
    
    
    // Find the tile in remaining rack
    const tileIndex = gameState.remainingRack.findIndex(t => {
      if (gameTile.isBlank && t.isBlank) return true
      return t.letter === gameTile.letter && t.points === gameTile.points
    })
    
    if (tileIndex === -1) return
    
    // Remove tile from rack and add to pending
    const newRack = [...gameState.remainingRack]
    newRack.splice(tileIndex, 1)
    
    const newPendingTile: PlacedTile = {
      ...gameTile,
      row,
      col
    }
    
    setGameState(prev => ({
      ...prev,
      remainingRack: newRack,
      pendingTiles: [...prev.pendingTiles, newPendingTile]
    }))
    
    setSelectedTileIndex(null)
  }

  const handlePickupTile = (row: number, col: number) => {
    if (gameState.isGameOver) return
    
    // Find pending tile at this position
    const tileIndex = gameState.pendingTiles.findIndex(t => t.row === row && t.col === col)
    if (tileIndex === -1) return
    
    const pickedTile = gameState.pendingTiles[tileIndex]
    const newPendingTiles = [...gameState.pendingTiles]
    newPendingTiles.splice(tileIndex, 1)

    // Return tile to rack, resetting blank tiles
    const { row: _, col: __, ...rackTile } = pickedTile
    const resetTile = rackTile.isBlank ? { ...rackTile, letter: '' } : rackTile

    setGameState(prev => ({
      ...prev,
      remainingRack: [...prev.remainingRack, resetTile],
      pendingTiles: newPendingTiles
    }))
  }

  const submitMove = async () => {
    if (!gameState.puzzle || gameState.pendingTiles.length === 0) return
    
    // Validate move
    const validation = validateMoveLogic(initialBoard, gameState.pendingTiles)
    if (!validation.isValid) {
      toast({
        title: "Invalid Move",
        description: validation.errors[0],
        variant: "destructive"
      })
      return
    }
    
    // Find words formed
    const newWords = findNewWordsFormed(initialBoard, gameState.pendingTiles)
    if (newWords.length === 0) {
      toast({
        title: "No Words Found",
        description: "Your move must form at least one word",
        variant: "destructive"
      })
      return
    }
    
    // Validate words in dictionary
    const invalidWords = newWords.filter(w => !isValidWord(w.word))
    if (invalidWords.length > 0) {
      toast({
        title: "Invalid Words",
        description: `"${invalidWords[0].word}" is not in the dictionary`,
        variant: "destructive"
      })
      return
    }
    
    // Calculate score
    const score = calculateNewMoveScore(newWords, gameState.pendingTiles)
    
    // Create move key and check if it matches any top move
    const userMove = createMovesFromTiles(gameState.pendingTiles)
    userMove.words = newWords.map(w => w.word)
    userMove.score = score
    const userMoveKey = getMoveKey(userMove)
    
    // Check if this move is in the top 5
    const matchingMove = gameState.puzzle.topMoves.find(move => {
      const topMoveKey = getMoveKey(move)
      return topMoveKey === userMoveKey
    })
    
    if (matchingMove && !gameState.foundMoves.has(userMoveKey)) {
      // Correct move found!
      setGameState(prev => {
        const newFoundMoves = new Set([...prev.foundMoves, userMoveKey])
        const nextUnfoundIndex = prev.puzzle?.topMoves.findIndex((move, index) => 
          !newFoundMoves.has(getMoveKey(move))
        ) ?? 0
        
        return {
          ...prev,
          foundMoves: newFoundMoves,
          pendingTiles: [],
          remainingRack: [...gameState.puzzle!.rack], // Reset rack
          totalScore: prev.totalScore + matchingMove.score,
          hints: {
            currentMoveIndex: nextUnfoundIndex,
            anchorRevealed: false,
            lengthRevealed: false,
            lettersRevealed: false
          }
        }
      })
      
      toast({
        title: "Great Move!",
        description: `Found "${matchingMove.words.join(', ')}" for ${matchingMove.score} points!`,
        variant: "default"
      })
      
      // Check if all moves found
      if (gameState.foundMoves.size + 1 >= gameState.puzzle.topMoves.length) {
        setTimeout(() => endGame(), 1000)
      }
    } else {
      toast({
        title: "Not a Top Move",
        description: `"${newWords.map(w => w.word).join(', ')}" (${score} pts) is not one of the top 5 moves`,
        variant: "destructive"
      })
    }
  }

  const cancelMove = () => {
    if (gameState.isGameOver || !gameState.puzzle) return
    
    setGameState(prev => ({
      ...prev,
      pendingTiles: [],
      remainingRack: [...gameState.puzzle!.rack]
    }))
    setSelectedTileIndex(null)
  }

  const retrySubmission = async () => {
    if (!user || !currentPuzzleId) return
    
    try {
      await submitPuzzleScore({
        puzzleId: currentPuzzleId,
        userId: user.id,
        score: gameState.totalScore
      })
      
      toast({
        title: "Score Submitted!",
        description: `Your score of ${gameState.totalScore} points has been recorded.`,
        variant: "default"
      })
      setShowSubmissionError(false)
    } catch (error) {
      console.error('Error retrying submission:', error)
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit score')
    }
  }

  // Hint functions
  const revealAnchor = () => {
    setGameState(prev => ({
      ...prev,
      hints: { ...prev.hints, anchorRevealed: true }
    }))
  }

  const revealLength = () => {
    setGameState(prev => ({
      ...prev,
      hints: { ...prev.hints, lengthRevealed: true }
    }))
  }

  const revealLetters = () => {
    setGameState(prev => ({
      ...prev,
      hints: { ...prev.hints, lettersRevealed: true }
    }))
  }

  const surrenderCurrentMove = () => {
    if (!gameState.puzzle || gameState.isGameOver || !currentTargetMove) return
    
    // Ensure lettersUsed is populated
    const lettersUsed = currentTargetMove.lettersUsed || currentTargetMove.tiles.map(t => t.letter).sort()
    
    // Show solution tiles as pending for visual feedback
    setGameState(prevState => ({
      ...prevState,
      pendingTiles: [...currentTargetMove.tiles],
      remainingRack: [...gameState.puzzle!.rack] // Reset rack
    }))
    
    // Get the move key for the current target move
    const currentMoveKey = getMoveKey(currentTargetMove)
    
    // After 800ms, clear the visual tiles and mark as found
    setTimeout(() => {
      setGameState(prev => {
        const newFoundMoves = new Set([...prev.foundMoves, currentMoveKey])
        const nextUnfoundIndex = prev.puzzle?.topMoves.findIndex((move, index) => 
          !newFoundMoves.has(getMoveKey(move))
        ) ?? 0
        
        return {
          ...prev,
          foundMoves: newFoundMoves,
          pendingTiles: [], // Clear the visual tiles
          totalScore: prev.totalScore + currentTargetMove.score,
          hints: {
            currentMoveIndex: nextUnfoundIndex,
            anchorRevealed: false,
            lengthRevealed: false,
            lettersRevealed: false
          }
        }
      })
      
      // Check if all moves found
      if (gameState.foundMoves.size + 1 >= gameState.puzzle.topMoves.length) {
        setTimeout(() => endGame(), 1000)
      }
    }, 800)
    
    toast({
      title: "Soluzione Rivelata",
      description: `"${currentTargetMove.words.join(', ')}" per ${currentTargetMove.score} punti`,
      variant: "default"
    })
  }

  // Get current target move for hints - find the first unfound move
  const currentTargetMove = gameState.puzzle?.topMoves.find((move, index) => 
    !gameState.foundMoves.has(getMoveKey(move))
  )

  // Generate highlight squares for hints
  const highlightSquares = []
  if (currentTargetMove && gameState.hints.anchorRevealed && currentTargetMove.startCell) {
    highlightSquares.push({
      row: currentTargetMove.startCell.row,
      col: currentTargetMove.startCell.col,
      type: 'anchor' as const
    })
  }

  if (!apiPuzzle && !puzzleError && !gameState.puzzle) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 animate-pulse text-primary" />
            <p className="text-lg">Loading new puzzle...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!gameState.puzzle) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="text-center">
          <p className="text-lg mb-4">Failed to load puzzle</p>
          <Button onClick={resetAndRefetch}>Try Again</Button>
        </div>
      </div>
    )
  }

  const selectedTile = selectedTileIndex !== null ? gameState.remainingRack[selectedTileIndex] : null

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <BlankTileDialog
        open={!!blankTile}
        onOpenChange={(open) => {
          if (!open) setBlankTile(null)
        }}
        onSelect={(letter) => {
          if (blankTile) {
            handlePlaceTile(blankTile.row, blankTile.col, { ...blankTile.tile, letter })
            setBlankTile(null)
          }
        }}
      />
      <div className="mb-6 flex items-center gap-4">
        <Link to="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          {isDailyMode ? <Calendar className="h-8 w-8 text-yellow-500" /> : <Zap className="h-8 w-8 text-primary" />}
          {isDailyMode ? 'Daily Puzzle Challenge' : 'Puzzle 90s'}
        </h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Game Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer and Score */}
          <div className="flex gap-4">
            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{gameState.totalScore}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Board */}
          <div className="flex justify-center">
          <ScrabbleBoard
            disabled={gameState.isGameOver}
            selectedTile={selectedTile}
            onUseSelectedTile={() => setSelectedTileIndex(null)}
            boardMap={initialBoard}
            pendingTiles={gameState.pendingTiles}
            onPlaceTile={(row, col, tile) => {
              const gameTile: Tile = 'value' in tile && !('points' in tile)
                ? { letter: tile.letter, points: Number(tile.value), isBlank: Boolean('isBlank' in tile ? tile.isBlank : false) }
                : tile as Tile
              if (gameTile.isBlank && gameTile.letter === '') {
                setBlankTile({ row, col, tile: gameTile })
              } else {
                handlePlaceTile(row, col, gameTile)
              }
            }}
            onPickupTile={handlePickupTile}
            highlightSquares={highlightSquares}
          />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button 
              onClick={submitMove}
              disabled={gameState.isGameOver || gameState.pendingTiles.length === 0}
              size="lg"
            >
              <Check className="h-4 w-4 mr-2" />
              Submit Move
            </Button>
            <Button 
              variant="outline"
              onClick={cancelMove}
              disabled={gameState.isGameOver || gameState.pendingTiles.length === 0}
              size="lg"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={surrenderCurrentMove}
              disabled={gameState.isGameOver || !currentTargetMove}
              size="lg"
            >
              <X className="h-4 w-4 mr-2" />
              Surrender
            </Button>
          </div>

          {/* Rack */}
          <TileRack
            tiles={gameState.remainingRack}
            selectedTiles={selectedTileIndex !== null ? [selectedTileIndex] : []}
            onTileSelect={handleTileSelect}
            onTileDragStart={handleTileDragStart}
          />

          {/* Game Over */}
          {gameState.isGameOver && (
            <Card>
              <CardContent className="p-6 text-center">
                <h3 className="text-2xl font-bold mb-4">Game Over!</h3>
                <p className="text-lg mb-4">
                  You found {gameState.foundMoves.size} out of {gameState.puzzle.topMoves.length} top moves
                </p>
                <p className="text-xl font-semibold mb-4">
                  Final Score: {gameState.totalScore} points
                </p>
                <Button onClick={resetAndRefetch} size="lg" disabled={isRefetching}>
                  {isRefetching ? 'Loading...' : 'New Puzzle'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Leaderboard - Mobile: show above top moves */}
          <div className="lg:order-2">
            <PuzzleLeaderboard />
          </div>
          
          <div className="lg:order-1">
            <PuzzleTopMoves
              topMoves={gameState.puzzle.topMoves}
              foundMoves={gameState.foundMoves}
            />
          </div>
          
          {/* Hints Panel */}
          {currentTargetMove && !gameState.isGameOver && (
            <Card className="lg:order-3">
              <CardHeader>
                <CardTitle className="text-lg">Hints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground mb-4">
                  Hints for move #{gameState.hints.currentMoveIndex + 1}
                </div>
                
                {/* Hint 1: Anchor Cell */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revealAnchor}
                    disabled={gameState.hints.anchorRevealed}
                    className="w-full justify-start"
                  >
                    {gameState.hints.anchorRevealed ? '✓' : '1.'} Highlight starting cell
                  </Button>
                  {gameState.hints.anchorRevealed && (
                    <p className="text-sm text-muted-foreground ml-4">
                      See the highlighted cell on the board
                    </p>
                  )}
                </div>
                
                {/* Hint 2: Word Length */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revealLength}
                    disabled={gameState.hints.lengthRevealed}
                    className="w-full justify-start"
                  >
                    {gameState.hints.lengthRevealed ? '✓' : '2.'} Show word length
                  </Button>
                  {gameState.hints.lengthRevealed && (
                    <p className="text-sm text-muted-foreground ml-4">
                      The main word has {currentTargetMove.mainWordLength} letters
                    </p>
                  )}
                </div>
                
                {/* Hint 3: Letters Used */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revealLetters}
                    disabled={gameState.hints.lettersRevealed}
                    className="w-full justify-start"
                  >
                    {gameState.hints.lettersRevealed ? '✓' : '3.'} Reveal letters to use
                  </Button>
                  {gameState.hints.lettersRevealed && (
                    <p className="text-sm text-muted-foreground ml-4">
                      Use these letters: {currentTargetMove.lettersUsed?.join(', ')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Error Dialog */}
      <AlertDialog open={showSubmissionError} onOpenChange={setShowSubmissionError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Score Submission Failed</AlertDialogTitle>
            <AlertDialogDescription>
              {submissionError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={retrySubmission}>
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PuzzleGame