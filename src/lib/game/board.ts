import type { PlacedTile, Tile as GameTile } from '@/types/game'
import type { Tile as StoreTile } from '@/store/game'

// Board può essere una mappa controllata (puzzle/gioco locale)
// oppure la griglia dello store (15x15) con StoreTile|null
export type AnyBoard = Map<string, PlacedTile> | (StoreTile | null)[][]

export function boardKey(row: number, col: number): string {
  return `${row},${col}`
}

export function getBoardTile(
  board: AnyBoard,
  row: number,
  col: number
): PlacedTile | StoreTile | null | undefined {
  if (board instanceof Map) {
    return board.get(boardKey(row, col))
  }
  return board[row]?.[col] ?? undefined
}

export function hasPendingAt(pending: PlacedTile[], row: number, col: number): boolean {
  return pending.some(t => t.row === row && t.col === col)
}

export function getPendingAt(pending: PlacedTile[], row: number, col: number): PlacedTile | undefined {
  return pending.find(t => t.row === row && t.col === col)
}

export function canPlaceAt(board: AnyBoard, pending: PlacedTile[], row: number, col: number): boolean {
  const onBoard = getBoardTile(board, row, col)
  const occupied = (onBoard !== null && onBoard !== undefined) || hasPendingAt(pending, row, col)
  return !occupied
}

export function coerceToStoreTile(tile: StoreTile | GameTile): StoreTile {
  if ('id' in tile) return tile as StoreTile
  const g = tile as GameTile as any
  return {
    id: `${g.letter}-${Date.now()}-${Math.random()}`,
    letter: g.letter,
    value: (g.points ?? g.value ?? 1) as number,
  }
}
