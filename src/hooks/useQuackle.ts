import { useState, useCallback } from 'react'
import { Difficulty } from '@/components/DifficultyModal'
import { GameState, Tile } from '@/types/game'
import { getBestMove, QuackleMove } from '@/api/quackle'

export const useQuackle = () => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [isThinking, setIsThinking] = useState(false)

  const makeMove = useCallback(async (
    gameState: GameState,
    playerRack: Tile[]
  ): Promise<QuackleMove | null> => {
    if (!difficulty) return null
    
    setIsThinking(true)
    try {
      // Add artificial thinking time for better UX
      const thinkingTime = getThinkingTime(difficulty)
      const [move] = await Promise.all([
        getBestMove(gameState, playerRack, difficulty),
        new Promise(resolve => setTimeout(resolve, thinkingTime))
      ])
      
      return move
    } finally {
      setIsThinking(false)
    }
  }, [difficulty])

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