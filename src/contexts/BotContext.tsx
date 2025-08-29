import { createContext, useContext, ReactNode } from 'react'
import { useBot } from '@/hooks/useBot'
import { Difficulty } from '@/components/DifficultyModal'
import { GameState, Tile } from '@/types/game'

import { BotMove } from '@/ai/ScrabbleBot'

interface BotContextType {
  difficulty: Difficulty | null
  setDifficulty: (difficulty: Difficulty) => void
  makeBotMove: (gameState: GameState, playerRack: Tile[]) => Promise<BotMove | null>
  isBotThinking: boolean
  generateAllPossibleMoves: (gameState: GameState, playerRack: Tile[]) => BotMove[]
  selectBestMove: (moves: BotMove[], difficulty: Difficulty) => BotMove | null
  canMakeMove: (gameState: GameState, playerRack: Tile[]) => boolean
}

const BotContext = createContext<BotContextType | undefined>(undefined)

export const useBotContext = () => {
  const context = useContext(BotContext)
  if (!context) {
    throw new Error('useBotContext must be used within a BotProvider')
  }
  return context
}

interface BotProviderProps {
  children: ReactNode
}

export const BotProvider = ({ children }: BotProviderProps) => {
  const botLogic = useBot()
  
  return (
    <BotContext.Provider value={botLogic}>
      {children}
    </BotContext.Provider>
  )
}