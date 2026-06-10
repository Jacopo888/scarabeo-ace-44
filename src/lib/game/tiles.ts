import type { PlacedTile } from '@/types/game'
import type { Board } from '@/core/board'

const BOARD_SIZE = 15

export interface QuackleTileConflict {
  row: number
  col: number
  existing?: PlacedTile
  incoming: PlacedTile
  reason: 'occupied_by_different_tile' | 'duplicate_coordinate'
}

export interface PreparedQuackleTiles {
  tiles: PlacedTile[]
  anchors: PlacedTile[]
  conflicts: QuackleTileConflict[]
  droppedInvalid: number
  droppedDuplicate: number
}

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

function sameBoardLetter(existing: PlacedTile, incoming: PlacedTile): boolean {
  const existingLetter = String(existing.letter ?? '').trim().toUpperCase()
  const incomingLetter = String(incoming.letter ?? '').trim().toUpperCase()
  return !!existingLetter && existingLetter === incomingLetter
}

function samePlacedTile(a: PlacedTile, b: PlacedTile): boolean {
  return a.row === b.row
    && a.col === b.col
    && a.letter === b.letter
    && !!a.isBlank === !!b.isBlank
}

export function prepareQuacklePlacementTiles(
  rawTiles: Array<Partial<PlacedTile> | null | undefined> | null | undefined,
  board: Board
): PreparedQuackleTiles {
  const result: PreparedQuackleTiles = {
    tiles: [],
    anchors: [],
    conflicts: [],
    droppedInvalid: 0,
    droppedDuplicate: 0
  }

  if (!Array.isArray(rawTiles)) {
    return result
  }

  const seen = new Map<string, PlacedTile>()

  for (const rawTile of rawTiles) {
    const tile = sanitizeQuackleTile(rawTile)
    if (!tile) {
      result.droppedInvalid += 1
      continue
    }

    const key = `${tile.row},${tile.col}`
    const previous = seen.get(key)
    if (previous) {
      if (samePlacedTile(previous, tile)) {
        result.droppedDuplicate += 1
        continue
      }
      result.conflicts.push({
        row: tile.row,
        col: tile.col,
        incoming: tile,
        reason: 'duplicate_coordinate'
      })
      continue
    }
    seen.set(key, tile)

    const existing = board[tile.row]?.[tile.col] ?? null
    if (existing) {
      if (sameBoardLetter(existing, tile)) {
        result.anchors.push(tile)
        continue
      }
      result.conflicts.push({
        row: tile.row,
        col: tile.col,
        existing,
        incoming: tile,
        reason: 'occupied_by_different_tile'
      })
      continue
    }

    result.tiles.push(tile)
  }

  return result
}

