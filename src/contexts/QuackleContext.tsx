import { createContext, useContext, ReactNode } from 'react'
import { useQuackle } from '@/hooks/useQuackle'
import { Difficulty } from '@/components/DifficultyModal'
import { GameState, Tile } from '@/types/game'
import type { QuackleMove } from '@/services/quackleClient'

interface QuackleContextType {
  difficulty: Difficulty | null
  setDifficulty: (difficulty: Difficulty | null) => void
  makeMove: (gameState: GameState, playerRack: Tile[], difficulty: Difficulty | null) => Promise<QuackleMove | null>
  isThinking: boolean
  // Latest engine telemetry from the last completed move (if any)
  lastEngineInfo: QuackleMove['engine_info'] | null
}

const QuackleContext = createContext<QuackleContextType | undefined>(undefined)

export const useQuackleContext = () => {
  const context = useContext(QuackleContext)
  if (!context) {
    throw new Error('useQuackleContext must be used within a QuackleProvider')
  }
  return context
}

interface QuackleProviderProps {
  children: ReactNode
}

export const QuackleProvider = ({ children }: QuackleProviderProps) => {
  const quackleLogic = useQuackle()
  
  return (
    <QuackleContext.Provider value={quackleLogic}>
      {children}
    </QuackleContext.Provider>
  )
}