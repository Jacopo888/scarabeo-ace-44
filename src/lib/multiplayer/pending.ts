import type { PlacedTile, Tile } from '@/types/game'

/**
 * Returns a new pending tiles array where the tile at (row,col) is replaced/added.
 * Any previous tile at the same coordinates is removed to avoid duplicates.
 */
export function upsertPendingTile(
  pending: PlacedTile[],
  row: number,
  col: number,
  tile: Tile
): PlacedTile[] {
  const filtered = pending.filter(t => !(t.row === row && t.col === col))
  const next: PlacedTile = { ...tile, row, col }
  return [...filtered, next]
}

/**
 * Returns a new pending tiles array without the tile at (row,col).
 */
export function removePendingTile(
  pending: PlacedTile[],
  row: number,
  col: number
): PlacedTile[] {
  return pending.filter(t => !(t.row === row && t.col === col))
}
