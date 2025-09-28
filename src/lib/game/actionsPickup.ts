import type { GameState, PlacedTile, Player, Tile } from '@/types/game'

export interface PickupResult {
  next: GameState
  pickedTile?: PlacedTile
  didPickup: boolean
}

export function applyPickupTile(prev: GameState, row: number, col: number, pendingTiles: PlacedTile[]): PickupResult {
  const idx = pendingTiles.findIndex(t => t.row === row && t.col === col)
  if (idx === -1) return { next: prev, didPickup: false }

  const tile = pendingTiles[idx]
  const returnedTile: Tile = tile.isBlank ? { ...tile, letter: '' } : tile

  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    rack: [...currentPlayer.rack, returnedTile]
  }

  return {
    next: {
      ...prev,
      players: newPlayers
    },
    pickedTile: tile,
    didPickup: true
  }
}
