import { PlacedTile } from '@/types/game'

// Compute the primary word from placed tiles in order of placement
export const calculatePrimaryWord = (tilesPlaced: PlacedTile[]): string => {
  if (tilesPlaced.length === 0) return ''
  const sorted = [...tilesPlaced].sort((a, b) => {
    if (a.row === b.row) return a.col - b.col
    return a.row - b.row
  })
  return sorted.map(t => t.letter).join('')
}

// Fetch next move index from a list returned by supabase query
export const nextMoveIndex = (maxExisting?: number): number =>
  maxExisting && maxExisting > 0 ? maxExisting + 1 : 1
