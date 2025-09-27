import type { PlacedTile } from '@/types/game'

export const sanitizeQuackleTile = (tile: PlacedTile): PlacedTile | null => {
  if (!tile) return null

  const rawLetter = (tile.letter ?? '').toString().trim()

  // Skip placeholder dots sent by Quackle
  if (!rawLetter || rawLetter === '.') {
    return null
  }

  const upperLetter = rawLetter.toUpperCase()
  const isBlank = tile.isBlank || upperLetter === '?'
  // Service returns 0-based coordinates: ensure finite integers within [0,14]
  const rowRaw = (tile as any).row
  const colRaw = (tile as any).col
  const rowNum = Number(rowRaw)
  const colNum = Number(colRaw)
  if (!Number.isFinite(rowNum) || !Number.isFinite(colNum)) return null
  if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return null
  if (rowNum < 0 || rowNum > 14 || colNum < 0 || colNum > 14) return null
  const row = rowNum
  const col = colNum

  return {
    ...tile,
    letter: upperLetter,
    isBlank,
    points: isBlank ? 0 : (Number(tile.points) || 0),
    row,
    col
  }
}
