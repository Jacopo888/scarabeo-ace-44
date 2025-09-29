import type { PlacedTile } from '@/types/game'

// Returns true if the set of new tiles are contiguous along a row or a column
export const areNewTilesContiguous = (newTiles: PlacedTile[]): boolean => {
  if (newTiles.length <= 1) return true

  const sortedTiles = [...newTiles].sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row
  )

  const isHorizontal = sortedTiles.every(t => t.row === sortedTiles[0].row)
  const isVertical = sortedTiles.every(t => t.col === sortedTiles[0].col)

  if (isHorizontal) {
    for (let i = 1; i < sortedTiles.length; i++) {
      if (sortedTiles[i].col - sortedTiles[i - 1].col > 1) return false
    }
    return true
  }

  if (isVertical) {
    for (let i = 1; i < sortedTiles.length; i++) {
      if (sortedTiles[i].row - sortedTiles[i - 1].row > 1) return false
    }
    return true
  }

  return false
}
