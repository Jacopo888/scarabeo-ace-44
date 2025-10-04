import type { PlacedTile } from '@/types/game'
import type { Board } from '@/core/board'

export type MoveDeps = {
  validateMoveLogic: (board: Board, pending: PlacedTile[]) => { isValid: boolean; errors: string[] }
  findNewWordsFormed: (board: Board, pending: PlacedTile[]) => { word: string }[]
  calculateScore: (opts: { tiles: PlacedTile[]; board: Board; context?: 'player' | 'quackle' }) => number
  isValidWord: (w: string) => boolean
}

export type MoveOutcome = {
  ok: boolean
  errors?: string[]
  newWords: { word: string }[]
  score: number
}

// Pure helper: validates a move, filters invalid words using deps, and computes score.
export function computeValidatedMove(board: Board, pendingTiles: PlacedTile[], deps: MoveDeps): MoveOutcome {
  const { validateMoveLogic, findNewWordsFormed, calculateScore, isValidWord } = deps
  const validation = validateMoveLogic(board, pendingTiles)
  if (!validation.isValid) return { ok: false, errors: validation.errors, newWords: [], score: 0 }
  const newWords = findNewWordsFormed(board, pendingTiles)
  const invalid = newWords.filter(w => !isValidWord(w.word))
  if (invalid.length > 0) return { ok: false, errors: invalid.map(w => w.word), newWords: [], score: 0 }
  const score = calculateScore({ tiles: pendingTiles, board, context: 'player' })
  return { ok: true, newWords, score }
}

// Pure helper: applies pending tiles to a board map and returns a new record object.
export function applyPendingTilesToBoard(board: Board, pendingTiles: PlacedTile[]): Record<string, PlacedTile> {
  const record: Record<string, PlacedTile> = {}
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const t = board[r][c]
      if (t) record[`${r},${c}`] = t
    }
  }
  pendingTiles.forEach(t => { record[`${t.row},${t.col}`] = t })
  return record
}
