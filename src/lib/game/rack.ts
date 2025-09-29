import type { GameState, Tile } from '@/types/game'
import { shuffleArray } from './random'

// Returns the active player's rack, or empty array if unavailable (do not mutate)
export const getCurrentRack = (state: GameState): Tile[] => {
  const p = state.players[state.currentPlayerIndex]
  return p ? [...p.rack] : []
}

// Returns a new rack array shuffled, without mutating the input
export const reshuffleRack = (rack: Tile[]): Tile[] => shuffleArray([...rack])

// Helper to set a player's rack at current index; returns updated players array (pure)
export const withCurrentRack = (state: GameState, rack: Tile[]) => {
  if (!state.players[state.currentPlayerIndex]) return state.players
  const players = [...state.players]
  players[state.currentPlayerIndex] = { ...players[state.currentPlayerIndex], rack }
  return players
}
