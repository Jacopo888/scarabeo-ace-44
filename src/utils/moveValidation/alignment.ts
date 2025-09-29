import type { PlacedTile } from '@/types/game'

// Returns true if all tiles are in exactly one row or one column
export const areTilesInSingleLine = (tiles: PlacedTile[]): boolean => {
  if (tiles.length <= 1) return true
  const sameRow = tiles.every(t => t.row === tiles[0].row)
  const sameCol = tiles.every(t => t.col === tiles[0].col)
  return sameRow || sameCol
}
