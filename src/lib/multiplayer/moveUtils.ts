import type { PlacedTile } from '@/types/game'

export type MoveDeps = {
  validateMoveLogic: (board: Map<string, PlacedTile>, pending: PlacedTile[]) => { isValid: boolean; errors: string[] }
  findNewWordsFormed: (board: Map<string, PlacedTile>, pending: PlacedTile[]) => { word: string }[]
  calculateNewMoveScore: (words: { word: string }[], pending: PlacedTile[]) => number
  isValidWord: (w: string) => boolean
}

export type MoveOutcome = {
  ok: boolean
  errors?: string[]
  newWords: { word: string }[]
  score: number
}

// Pure helper: validates a move, filters invalid words using deps, and computes score.
export function computeValidatedMove(
  boardMap: Map<string, PlacedTile>,
  pendingTiles: PlacedTile[],
  deps: MoveDeps
): MoveOutcome {
  const { validateMoveLogic, findNewWordsFormed, calculateNewMoveScore, isValidWord } = deps

  const validation = validateMoveLogic(boardMap, pendingTiles)
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors, newWords: [], score: 0 }
  }

  const newWords = findNewWordsFormed(boardMap, pendingTiles)
  const invalid = newWords.filter(w => !isValidWord(w.word))
  if (invalid.length > 0) {
    return { ok: false, errors: invalid.map(w => w.word), newWords: [], score: 0 }
  }

  const score = calculateNewMoveScore(newWords, pendingTiles)
  return { ok: true, newWords, score }
}

// Pure helper: applies pending tiles to a board map and returns a new record object.
export function applyPendingTilesToBoard(
  boardMap: Map<string, PlacedTile>,
  pendingTiles: PlacedTile[]
): Record<string, PlacedTile> {
  const next = new Map(boardMap)
  pendingTiles.forEach(tile => {
    const key = `${tile.row},${tile.col}`
    next.set(key, tile)
  })
  return Object.fromEntries(next)
}
