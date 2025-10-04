import type { PlacedTile } from '@/types/game'
import { computeValidatedMove, applyPendingTilesToBoard, type MoveDeps } from './moveUtils'
import type { Board } from '@/core/board'

export type PreparedSubmit =
  | { ok: false; errors: string[] }
  | { ok: true; score: number; words: string[]; newBoardState: Record<string, PlacedTile> }

/**
 * Pure orchestrator: validates a move and, if valid, returns
 * the score, words and the resulting board state after applying pending tiles.
 */
export function prepareSubmitOutcome(
  board: Board,
  pendingTiles: PlacedTile[],
  deps: MoveDeps
): PreparedSubmit {
  const outcome = computeValidatedMove(board, pendingTiles, deps)
  if (!outcome.ok) {
    return { ok: false, errors: outcome.errors || [] }
  }
  const newBoardState = applyPendingTilesToBoard(board, pendingTiles)
  return { ok: true, score: outcome.score, words: outcome.newWords.map(w => w.word), newBoardState }
}
