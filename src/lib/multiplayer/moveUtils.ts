import type { PlacedTile } from '@/types/game'
import type { Board } from '@/core/board'
import { mapToBoard } from '@/core/adapters'

export type MoveDeps = {
  // Allow both legacy Map and matrix Board; adapters will normalize
  validateMoveLogic: (board: Map<string, PlacedTile> | Board, pending: PlacedTile[]) => { isValid: boolean; errors: string[] }
  findNewWordsFormed: (board: Map<string, PlacedTile> | Board, pending: PlacedTile[]) => { word: string }[]
  calculateScore: ((opts: { tiles: PlacedTile[]; existingBoard: Map<string, PlacedTile>; context?: 'player' | 'quackle' }) => number)
                  | ((opts: { tiles: PlacedTile[]; board: Board; context?: 'player' | 'quackle' }) => number)
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
  boardInput: Map<string, PlacedTile> | Board,
  pendingTiles: PlacedTile[],
  deps: MoveDeps
): MoveOutcome {
  const { validateMoveLogic, findNewWordsFormed, calculateScore, isValidWord } = deps
  const boardForValidation = boardInput as any

  const validation = validateMoveLogic(boardForValidation, pendingTiles)
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors, newWords: [], score: 0 }
  }

  const newWords = findNewWordsFormed(boardForValidation, pendingTiles)
  const invalid = newWords.filter(w => !isValidWord(w.word))
  if (invalid.length > 0) {
    return { ok: false, errors: invalid.map(w => w.word), newWords: [], score: 0 }
  }

  // Call score with the appropriate shape based on provided function
  let score = 0
  if ('forEach' in (boardInput as any)) {
    // it's a Map
    score = (calculateScore as any)({ tiles: pendingTiles, existingBoard: boardInput, context: 'player' })
  } else {
    // assume matrix Board
    score = (calculateScore as any)({ tiles: pendingTiles, board: boardInput, context: 'player' })
  }
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
