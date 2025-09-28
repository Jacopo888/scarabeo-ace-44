import type { PlacedTile, Player } from '@/types/game'
import type { GameMoveLite } from '@/types/localGame'

export function contiguousSummary(tiles: PlacedTile[]) {
  const rows = tiles.map(t => t.row)
  const cols = tiles.map(t => t.col)
  const isHorizontal = tiles.every(t => t.row === tiles[0].row)
  const ordered = [...tiles].sort((a,b)=> isHorizontal ? a.col - b.col : a.row - b.row)
  const contiguous = ordered.every((t,i,arr) => i===0 || (isHorizontal ? t.col === arr[i-1].col + 1 : t.row === arr[i-1].row + 1))
  // eslint-disable-next-line no-console
  console.log('[useGame] sanitize summary:', { count: tiles.length, minRow: Math.min(...rows), maxRow: Math.max(...rows), minCol: Math.min(...cols), maxCol: Math.max(...cols), isH: isHorizontal, contiguous })
  if (!contiguous) {
    // eslint-disable-next-line no-console
    console.warn('[useGame] Non-contiguous bot tiles after sanitize; check indexing or anchor handling.', ordered)
  }
  return { isHorizontal, contiguous, ordered }
}

export function buildHistoryEntry(current: Player, tiles: PlacedTile[], score: number): Omit<GameMoveLite, 'move_index'> {
  const { isHorizontal, ordered } = contiguousSummary(tiles)
  const placedString = ordered.map(t => t.letter).join('')
  const row = Math.min(...tiles.map(t => t.row))
  const col = Math.min(...tiles.map(t => t.col))
  return {
    word: placedString,
    score_earned: score,
    rack_before: current.rack,
    player_id: current.id,
    row,
    col,
    dir: isHorizontal ? 'H' : 'V'
  }
}
