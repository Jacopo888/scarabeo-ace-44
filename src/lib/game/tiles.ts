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
  
  // Despite README claiming 0-based, service actually returns 1-based coordinates [1,15]
  // We need to convert to internal 0-based [0,14]
  const rowRaw = (tile as any).row
  const colRaw = (tile as any).col
  const rowNum = Number(rowRaw)
  const colNum = Number(colRaw)
  if (!Number.isFinite(rowNum) || !Number.isFinite(colNum)) return null
  if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return null
  
  // Convert from 1-based to 0-based
  const row = rowNum - 1
  const col = colNum - 1
  
  // Validate bounds after conversion
  if (row < 0 || row > 14 || col < 0 || col > 14) return null

  return {
    ...tile,
    letter: upperLetter,
    isBlank,
    points: isBlank ? 0 : (Number(tile.points) || 0),
    row,
    col
  }
}
