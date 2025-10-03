import { Board, BOARD_SIZE, createEmptyBoard } from './board'
import { PlacedTile } from '@/types/game'

export function mapToBoard(map: Map<string, PlacedTile>): Board {
  const board = createEmptyBoard()
  map.forEach((tile, key) => {
    const [rS, cS] = key.split(',')
    const r = Number(rS), c = Number(cS)
    if (Number.isFinite(r) && Number.isFinite(c) && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      board[r][c] = { ...tile }
    }
  })
  return board
}

export function boardToMap(board: Board): Map<string, PlacedTile> {
  const out = new Map<string, PlacedTile>()
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const t = board[r][c]
      if (t) out.set(`${r},${c}`, { ...t })
    }
  }
  return out
}

export function toPlacedMove(pending: PlacedTile[]): PlacedTile[] {
  // Ensure unique positions and a clean copy
  const seen = new Set<string>()
  const out: PlacedTile[] = []
  for (const t of pending) {
    const k = `${t.row},${t.col}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ ...t })
  }
  return out
}
