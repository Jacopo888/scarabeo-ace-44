import type { GameState, Player } from '@/types/game'

// Returns the current player or undefined if state is incomplete
export const getCurrentPlayer = (state: GameState): Player | undefined =>
  state.players[state.currentPlayerIndex]

// Checks if it's the given player's turn
export const isCurrentPlayerTurn = (state: GameState, playerId: string): boolean =>
  getCurrentPlayer(state)?.id === playerId

// Computes the next player index (wrap-around); returns 0 when no players
export const nextPlayerIndex = (state: GameState): number =>
  state.players.length === 0 ? 0 : (state.currentPlayerIndex + 1) % state.players.length
