import type { PlacedTile } from '@/types/game'

export const coversCenter = (tiles: PlacedTile[]): boolean =>
  tiles.some(tile => tile.row === 7 && tile.col === 7)
