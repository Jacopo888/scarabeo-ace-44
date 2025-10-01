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
  
  // Service returns coordinates that need +1 adjustment to match visual grid
  // Empirically verified: service row 6 should display at row 7 (center star)
  const rowRaw = (tile as any).row
  const colRaw = (tile as any).col
  const rowNum = Number(rowRaw)
  const colNum = Number(colRaw)
  if (!Number.isFinite(rowNum) || !Number.isFinite(colNum)) return null
  if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return null
  
  // Add 1 to match visual grid positioning
  const row = rowNum + 1
  const col = colNum + 1
  
  // Validate bounds after adjustment
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
