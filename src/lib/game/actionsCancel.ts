import type { GameState, PlacedTile, Player } from '@/types/game'

export function applyCancelMove(prev: GameState, pendingTiles: PlacedTile[]): GameState {
  if (!pendingTiles || pendingTiles.length === 0) return prev

  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    rack: [...currentPlayer.rack, ...pendingTiles.map(t => (t.isBlank ? { ...t, letter: '' } : t))]
  }

  return {
    ...prev,
    players: newPlayers
  }
}
