import type { PlacedTile } from '@/types/game'

export const areNewTilesAdjacentToBoard = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[]
): boolean => {
  return newTiles.some(tile => {
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ]

    return directions.some(([dRow, dCol]) => {
      const adjacentKey = `${tile.row + dRow},${tile.col + dCol}`
      return board.has(adjacentKey)
    })
  })
}
