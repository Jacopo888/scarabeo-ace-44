import type { PlacedTile } from '@/types/game'
import type { Board } from '@/core/board'
import { hasTile } from './boardUtils'

export const areGapsFilledByExistingTiles = (
  board: Board,
  newTiles: PlacedTile[]
): boolean => {
  if (newTiles.length <= 1) return true

  const sortedTiles = [...newTiles].sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row
  )

  const isHorizontal = sortedTiles.every(t => t.row === sortedTiles[0].row)

  if (isHorizontal) {
    for (let i = 1; i < sortedTiles.length; i++) {
      const prevCol = sortedTiles[i - 1].col
      const currentCol = sortedTiles[i].col
      for (let col = prevCol + 1; col < currentCol; col++) {
        if (!hasTile(board, sortedTiles[0].row, col)) return false
      }
    }
  } else {
    for (let i = 1; i < sortedTiles.length; i++) {
      const prevRow = sortedTiles[i - 1].row
      const currentRow = sortedTiles[i].row
      for (let row = prevRow + 1; row < currentRow; row++) {
        if (!hasTile(board, row, sortedTiles[0].col)) return false
      }
    }
  }

  return true
}
