import { useState, useCallback, useEffect, useRef } from 'react'
import { GameState, Player, Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
import { validateMoveLogic } from '@/utils/moveValidation'
import { findNewWordsFormed } from '@/utils/newWordFinder'
import { calculateNewMoveScore } from '@/utils/newScoring'
import { canEndGame, calculateEndGamePenalty } from '@/utils/gameRules'
import { useToast } from '@/hooks/use-toast'
import { useBotContext } from '@/contexts/BotContext'
import { useDictionary } from '@/contexts/DictionaryContext'
import type { GameMove } from './useGameAnalysis'

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
  const { difficulty, makeBotMove: botMakeBotMove } = useBotContext()
  const { isValidWord } = useDictionary()
  const [pendingTiles, setPendingTiles] = useState<PlacedTile[]>([])
  const [isBotTurn, setIsBotTurn] = useState(false)
  const [isSurrendered, setIsSurrendered] = useState(false)
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([])
  const gameIdRef = useRef<string>(crypto.randomUUID())
  const [gameState, setGameState] = useState<GameState>(() => {
    const shuffledBag = shuffleArray(TILE_DISTRIBUTION)
    const player1Tiles = drawTiles(shuffledBag, 7)
    const player2Tiles = drawTiles(player1Tiles.remaining, 7)

    const gameMode = difficulty ? 'bot' : 'human'
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
          name: difficulty ? `Bot (${difficulty})` : 'Player 2',
          score: 0,
          rack: player2Tiles.drawn,
          isBot: !!difficulty
        }
      ],
      currentPlayerIndex: startingPlayerIndex,
      tileBag: player2Tiles.remaining,
      gameStatus: 'playing',
      gameMode,
      passCounts: [0, 0]
    }
  })

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
    const shuffledBag = shuffleArray(TILE_DISTRIBUTION)
    const player1Tiles = drawTiles(shuffledBag, 7)
    const player2Tiles = drawTiles(player1Tiles.remaining, 7)

    const gameMode = difficulty ? 'bot' : 'human'
    const startingPlayerIndex = Math.floor(Math.random() * 2)

    setGameState({
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
          name: difficulty ? `Bot (${difficulty})` : 'Player 2',
          score: 0,
          rack: player2Tiles.drawn,
          isBot: !!difficulty
        }
      ],
      currentPlayerIndex: startingPlayerIndex,
      tileBag: player2Tiles.remaining,
      gameStatus: 'playing',
      gameMode,
      passCounts: [0, 0]
    })
    setPendingTiles([])
    setIsSurrendered(false)
    setMoveHistory([])
    gameIdRef.current = crypto.randomUUID()
  }, [difficulty])

  // Bot move logic
  const makeBotMove = useCallback(async () => {
    if (!difficulty || !botMakeBotMove) return
    
    setIsBotTurn(true)
    
    setGameState(prev => {
      const currentPlayer = prev.players[prev.currentPlayerIndex]
      if (!currentPlayer.isBot) return prev
      
      // Start async bot move generation
      botMakeBotMove(prev, currentPlayer.rack).then(bestMove => {
        if (!bestMove || bestMove.tiles.length === 0) {
          // Bot passes if no valid moves
          setIsBotTurn(false)
          setGameState(prevState => {
            const newPassCounts = [...(prevState.passCounts || Array(prevState.players.length).fill(0))]
            newPassCounts[prevState.currentPlayerIndex] += 1
            const totalPasses = newPassCounts.reduce((sum, c) => sum + c, 0)
            const endGame = canEndGame(
              prevState.players.map(p => ({ rack: p.rack })),
              prevState.tileBag,
              totalPasses
            )
            if (endGame) {
              const p1Penalty = calculateEndGamePenalty(prevState.players[0].rack)
              const p2Penalty = calculateEndGamePenalty(prevState.players[1].rack)
              let p1Score = prevState.players[0].score - p1Penalty
              let p2Score = prevState.players[1].score - p2Penalty
              if (p1Score > p2Score) p1Score += p2Penalty
              else if (p2Score > p1Score) p2Score += p1Penalty
              const finalPlayers: Player[] = [
                { ...prevState.players[0], score: p1Score },
                { ...prevState.players[1], score: p2Score }
              ]
              return {
                ...prevState,
                players: finalPlayers,
                gameStatus: 'finished',
                passCounts: newPassCounts
              }
            }
            return {
              ...prevState,
              currentPlayerIndex: (prevState.currentPlayerIndex + 1) % prevState.players.length,
              passCounts: newPassCounts
            }
          })
          return
        }
        
        setGameState(prevState => {
          // Place bot's tiles
          const newBoard = new Map(prevState.board)
          bestMove.tiles.forEach(tile => {
            const key = `${tile.row},${tile.col}`
            newBoard.set(key, tile)
          })
          
          // Update bot's rack (remove used tiles)
          const currentPlayer = prevState.players[prevState.currentPlayerIndex]
          const newRack = [...currentPlayer.rack]
          bestMove.tiles.forEach(usedTile => {
            const tileIndex = newRack.findIndex(t => {
              if (usedTile.isBlank && t.isBlank) return true
              return t.letter === usedTile.letter && t.points === usedTile.points
            })
            if (tileIndex !== -1) {
              newRack.splice(tileIndex, 1)
            }
          })
          
          // Draw new tiles for bot
          const tilesNeeded = 7 - newRack.length
          const { drawn, remaining } = tilesNeeded > 0 && prevState.tileBag.length > 0
            ? drawTiles(prevState.tileBag, Math.min(tilesNeeded, prevState.tileBag.length))
            : { drawn: [], remaining: prevState.tileBag }
          
          const newPlayers = [...prevState.players]
          newPlayers[prevState.currentPlayerIndex] = {
            ...currentPlayer,
            score: currentPlayer.score + bestMove.score,
            rack: [...newRack, ...drawn]
          }
          
          toast({
            title: "Bot played!",
            description: `Bot scored ${bestMove.score} points with: ${bestMove.words.join(', ')}`,
          })
          
          setIsBotTurn(false)

          // Record move for post-game analysis
          try {
            const isHorizontal = bestMove.tiles.every(t => t.row === bestMove.tiles[0].row)
            const ordered = [...bestMove.tiles].sort((a, b) =>
              isHorizontal ? a.col - b.col : a.row - b.row
            )
            const placedString = ordered.map(t => t.letter).join('')
            const row = Math.min(...bestMove.tiles.map(t => t.row))
            const col = Math.min(...bestMove.tiles.map(t => t.col))
            const moveInfo: Omit<GameMove, 'move_index'> = {
              word: placedString,
              score_earned: bestMove.score,
              rack_before: currentPlayer.rack,
              player_id: currentPlayer.id,
              row,
              col,
              dir: isHorizontal ? 'H' : 'V'
            }
            setMoveHistory(prev => [...prev, { ...moveInfo, move_index: prev.length + 1 }])
          } catch (e) {
            // ignore
          }
          
          const newPassCounts = [...(prevState.passCounts || Array(prevState.players.length).fill(0))]
          newPassCounts[prevState.currentPlayerIndex] = 0
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
              ...prevState,
              board: newBoard,
              players: finalPlayers,
              tileBag: remaining,
              gameStatus: 'finished',
              passCounts: newPassCounts,
              lastMove: bestMove.tiles
            }
          }
          return {
            ...prevState,
            board: newBoard,
            players: newPlayers,
            tileBag: remaining,
            currentPlayerIndex: (prevState.currentPlayerIndex + 1) % prevState.players.length,
            passCounts: newPassCounts,
            lastMove: bestMove.tiles
          }
        })
      }).catch(error => {
        console.error('Bot move error:', error)
        setIsBotTurn(false)
        // Bot passes on error
        setGameState(prevState => {
          const newPassCounts = [...(prevState.passCounts || Array(prevState.players.length).fill(0))]
          newPassCounts[prevState.currentPlayerIndex] += 1
          const totalPasses = newPassCounts.reduce((sum, c) => sum + c, 0)
          const endGame = canEndGame(
            prevState.players.map(p => ({ rack: p.rack })),
            prevState.tileBag,
            totalPasses
          )
          if (endGame) {
            const p1Penalty = calculateEndGamePenalty(prevState.players[0].rack)
            const p2Penalty = calculateEndGamePenalty(prevState.players[1].rack)
            let p1Score = prevState.players[0].score - p1Penalty
            let p2Score = prevState.players[1].score - p2Penalty
            if (p1Score > p2Score) p1Score += p2Penalty
            else if (p2Score > p1Score) p2Score += p1Penalty
            const finalPlayers: Player[] = [
              { ...prevState.players[0], score: p1Score },
              { ...prevState.players[1], score: p2Score }
            ]
            return {
              ...prevState,
              players: finalPlayers,
              gameStatus: 'finished',
              passCounts: newPassCounts
            }
          }
          return {
            ...prevState,
            currentPlayerIndex: (prevState.currentPlayerIndex + 1) % prevState.players.length,
            passCounts: newPassCounts
          }
        })
      })
      
      return prev // Return current state while bot is thinking
    })
  }, [difficulty, botMakeBotMove, toast])

  // Effect to handle bot turns
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]

    if (currentPlayer?.isBot && gameState.gameStatus === 'playing' && !isBotTurn) {
      makeBotMove()
    }
  }, [gameState.currentPlayerIndex, gameState.gameStatus, makeBotMove, isBotTurn, difficulty])

  // Effect to reset game when difficulty changes
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (difficulty) {
      resetGame()
    }
  }, [difficulty, resetGame])

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
    makeBotMove,
    isBotTurn,
    isSurrendered,
    currentPlayer: gameState.players[gameState.currentPlayerIndex],
    isCurrentPlayerTurn: (playerId: string) => gameState.players[gameState.currentPlayerIndex].id === playerId,
    moveHistory,
    gameId: gameIdRef.current
  }
}