import type { GameState, Tile, PlacedTile, Player } from '@/types/game'

export interface PlaceResult {
  next: GameState
  addedPending?: PlacedTile
  didPlace: boolean
}

export function applyPlaceTile(prev: GameState, row: number, col: number, tile: Tile): PlaceResult {
  const key = `${row},${col}`
  if (prev.board.has(key)) return { next: prev, didPlace: false }

  const currentPlayer = prev.players[prev.currentPlayerIndex]

  const tileIndex = currentPlayer.rack.findIndex(t => {
    if (tile.isBlank && t.isBlank) return true
    return t.letter === tile.letter && t.points === tile.points && t.isBlank === tile.isBlank
  })
  if (tileIndex === -1) return { next: prev, didPlace: false }

  const newRack = [...currentPlayer.rack]
  newRack.splice(tileIndex, 1)

  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    rack: newRack
  }

  const newTile: PlacedTile = { ...tile, row, col }

  return {
    next: {
      ...prev,
      players: newPlayers
    },
    addedPending: newTile,
    didPlace: true
  }
}
