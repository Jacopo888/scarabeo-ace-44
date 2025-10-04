import type { PlacedTile } from '@/types/game'
import type { Board } from '@/core/board'

export const hasTile = (board: Board, r: number, c: number): boolean => {
  return r >= 0 && r < 15 && c >= 0 && c < 15 && !!board[r][c]
}

export const cloneWithNewTiles = (board: Board, newTiles: PlacedTile[]): Board => {
  const next: Board = board.map(row => row.slice()) as Board
  newTiles.forEach(t => { next[t.row][t.col] = t })
  return next
}
