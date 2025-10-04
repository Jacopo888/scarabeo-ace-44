import type { PlacedTile } from '@/types/game'
import type { Board } from '@/core/board'
import { hasTile } from './boardUtils'

export const areNewTilesAdjacentToBoard = (board: Board, newTiles: PlacedTile[]): boolean => {
  return newTiles.some(tile => {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
    return dirs.some(([dr, dc]) => hasTile(board, tile.row + dr, tile.col + dc))
  })
}

