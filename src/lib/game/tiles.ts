import type { PlacedTile } from '@/types/game'

const BOARD_SIZE = 15

export function sanitizeQuackleTile(tile: Partial<PlacedTile> | null | undefined): PlacedTile | null {
  if (!tile) return null

  const { row, col } = tile
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null

  const rawLetter = String(tile.letter ?? '').trim()
  if (!rawLetter || rawLetter === '.' || rawLetter.length !== 1) return null

  const isBlank = tile.isBlank === true || rawLetter === '?'
  const letter = rawLetter === '?' ? '?' : rawLetter.toUpperCase()
  if (!isBlank && !/^[A-Z]$/.test(letter)) return null

  const rawPoints = tile.points
  const points = isBlank ? 0 : (typeof rawPoints === 'number' && Number.isFinite(rawPoints) ? rawPoints : 0)

  return {
    row,
    col,
    letter,
    points,
    isBlank
  }
}

