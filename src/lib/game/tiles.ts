import type { PlacedTile } from '@/types/game'
import { fromServiceCoord } from '@/lib/coords'

export const sanitizeQuackleTile = (tile: PlacedTile): PlacedTile | null => {
  if (!tile) return null

  const rawLetter = (tile.letter ?? '').toString().trim()

  // Skip placeholder dots sent by Quackle
  if (!rawLetter || rawLetter === '.') {
    return null
  }

  const upperLetter = rawLetter.toUpperCase()
  const isBlank = tile.isBlank || upperLetter === '?'
  
  // Service returns coordinates according to VITE_BOARD_SCHEMA (coord_map_1based by default)
  // Use fromServiceCoord to convert to internal 0-based representation
  const rowRaw = (tile as any).row
  const colRaw = (tile as any).col
  const rowNum = Number(rowRaw)
  const colNum = Number(colRaw)
  if (!Number.isFinite(rowNum) || !Number.isFinite(colNum)) return null
  if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return null
  
  // For coord_map_1based: backend sends [1,15], we need [0,14]
  // For coord_map_0based: backend sends [0,14], we keep [0,14]
  // fromServiceCoord handles the conversion based on VITE_BOARD_SCHEMA
  const coordKey = `${rowNum},${colNum}`
  const { row, col } = fromServiceCoord(coordKey)
  
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
