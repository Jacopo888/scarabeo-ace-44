import { useState, useCallback } from 'react'
import { Difficulty } from '@/components/DifficultyModal'
import { GameState, Tile } from '@/types/game'
import { quackleBestMove, QuackleMove } from '@/services/quackleClient'

export const useQuackle = () => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [isThinking, setIsThinking] = useState(false)

  const makeMove = useCallback(async (
    gameState: GameState,
    playerRack: Tile[],
    difficulty: Difficulty | null
  ): Promise<QuackleMove | null> => {
    if (!difficulty) return null
    
    setIsThinking(true)
    try {
      // Add artificial thinking time for better UX
      const thinkingTime = getThinkingTime(difficulty)
      
      // Create 15x15 board array for Quackle engine wrapper
      const boardCells: (string | null)[][] = Array(15).fill(null).map(() => Array(15).fill(null))
      gameState.board.forEach((tile) => {
        const row = tile.row
        const col = tile.col
        if (row >= 0 && row < 15 && col >= 0 && col < 15) {
          boardCells[row][col] = tile.isBlank ? '?' : tile.letter
        }
      })

      console.log('[useQuackle] Board cells with tiles:', boardCells.flat().filter(cell => cell !== null).length)

      // Format rack as string for Quackle engine wrapper
      const formatRackForQuackle = (rack: Tile[]): string => {
        return rack
          .filter(tile => tile.letter !== '' || tile.isBlank) // Keep non-blank tiles and proper blank tiles
          .map(tile => tile.letter === '' && tile.isBlank ? '?' : tile.letter) // Convert empty string blanks to '?'
          .join('')
      }

      const payload = {
        board: {
          cells: boardCells
        },
        rack: formatRackForQuackle(playerRack),
        difficulty
      }

      console.log('[useQuackle] Formatted rack for Quackle:', payload.rack)

      const [move] = await Promise.all([
        quackleBestMove(payload),
        new Promise(resolve => setTimeout(resolve, thinkingTime))
      ])
      
      console.log('[useQuackle] Raw move from Quackle service:', move)
      return move
    } finally {
      setIsThinking(false)
    }
  }, [])

  return {
    difficulty,
    setDifficulty,
    makeMove,
    isThinking
  }
}

function getThinkingTime(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy': return 800 + Math.random() * 1200   // 0.8-2.0s
    case 'medium': return 1200 + Math.random() * 1800 // 1.2-3.0s  
    case 'hard': return 1500 + Math.random() * 2500   // 1.5-4.0s
    default: return 1000
  }
}