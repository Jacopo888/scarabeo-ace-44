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
  
  // Service always returns 0-based coordinates [0,14] regardless of input format
  // (VITE_BOARD_SCHEMA affects only what we SEND, not what we RECEIVE)
  const rowRaw = (tile as any).row
  const colRaw = (tile as any).col
  const rowNum = Number(rowRaw)
  const colNum = Number(colRaw)
  if (!Number.isFinite(rowNum) || !Number.isFinite(colNum)) return null
  if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return null
  
  const row = rowNum
  const col = colNum
  
  // Validate bounds (service returns 0-based)
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
