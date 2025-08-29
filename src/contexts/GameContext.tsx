import { createContext, useContext, ReactNode } from 'react'
import { useGame } from '@/hooks/useGame'
import { GameState, Player, Tile, PlacedTile } from '@/types/game'
import type { GameMove } from '@/hooks/useGameAnalysis'

interface GameContextType {
  gameState: GameState
  pendingTiles: PlacedTile[]
  placeTile: (row: number, col: number, tile: Tile) => void
  pickupTile: (row: number, col: number) => void
  resetGame: () => void
  confirmMove: () => void
  cancelMove: () => void
  reshuffleTiles: () => void
  exchangeTiles: () => void
  passTurn: () => void
  surrenderGame: () => void
  makeBotMove: () => Promise<void>
  isBotTurn: boolean
  isSurrendered: boolean
  currentPlayer: Player
  isCurrentPlayerTurn: (playerId: string) => boolean
  moveHistory: GameMove[]
  gameId: string
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const useGameContext = () => {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider')
  }
  return context
}

interface GameProviderProps {
  children: ReactNode
}

export const GameProvider = ({ children }: GameProviderProps) => {
  const gameLogic = useGame()

  const {
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
    currentPlayer,
    isCurrentPlayerTurn,
    moveHistory,
    gameId
  } = gameLogic

  return (
    <GameContext.Provider
      value={{
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
        currentPlayer,
        isCurrentPlayerTurn,
        moveHistory,
        gameId
      }}
    >
      {children}
    </GameContext.Provider>
  )
}