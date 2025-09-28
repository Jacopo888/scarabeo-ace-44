import type { GameState, Player } from '@/types/game'
import { shuffleArray, drawTiles } from './random'

export function applyExchangeTiles(prev: GameState): GameState {
  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const rackSize = currentPlayer.rack.length

  // Not enough tiles in bag to exchange (require at least 2 tiles available as per common rule)
  if (prev.tileBag.length < Math.max(2, rackSize)) return prev

  const bagWithReturned = shuffleArray([...prev.tileBag, ...currentPlayer.rack])
  const { drawn, remaining } = drawTiles(bagWithReturned, rackSize)

  const newPlayers: Player[] = [...prev.players]
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
}
