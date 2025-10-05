import type { PlacedTile } from '@/types/game'
import { isDebugQuackle } from '@/config/debug'

export const sanitizeQuackleTile = (tile: PlacedTile): PlacedTile | null => {
  if (!tile) return null

  const rawLetter = (tile.letter ?? '').toString().trim()

  // Skip placeholder dots sent by Quackle
  if (!rawLetter || rawLetter === '.') {
    return null
  }

  const upperLetter = rawLetter.toUpperCase()
  const isBlank = tile.isBlank || upperLetter === '?'
  
  // Service returns tiles with 0-based coordinates (rows/cols in [0,14])
  // The UI also uses 0-based coordinates, so no offset is required here.
  const rowRaw = (tile as any).row
  const colRaw = (tile as any).col
  if (isDebugQuackle) {
    try {
      console.log('[sanitizeQuackleTile] IN  row,col=', rowRaw, colRaw, 'letter=', tile.letter, 'isBlank=', tile.isBlank)
    } catch {}
  }
  const rowNum = Number(rowRaw)
  const colNum = Number(colRaw)
  if (!Number.isFinite(rowNum) || !Number.isFinite(colNum)) return null
  if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return null

  const row = rowNum
  const col = colNum
  
  // COORDINATE TRACE: Log transformation in sanitize
  if (import.meta.env.DEV) {
    console.log('[sanitizeQuackleTile] 🎯 TRACE:', { letter: upperLetter, rowRaw, rowNum, row, 'row===rowNum': row === rowNum })
  }

  // Validate 0-based bounds
  if (row < 0 || row > 14 || col < 0 || col > 14) return null

  const out: PlacedTile = {
    ...tile,
    letter: upperLetter,
    isBlank,
    points: isBlank ? 0 : (Number(tile.points) || 0),
    row,
    col
  }
  if (isDebugQuackle) {
    try {
      console.log('[sanitizeQuackleTile] OUT row,col=', out.row, out.col)
    } catch {}
  }
  return out
}
