import type { PlacedTile } from '@/types/game'
import { computeValidatedMove, applyPendingTilesToBoard, type MoveDeps } from './moveUtils'

export type PreparedSubmit =
  | { ok: false; errors: string[] }
  | { ok: true; score: number; words: string[]; newBoardState: Record<string, PlacedTile> }

/**
 * Pure orchestrator: validates a move and, if valid, returns
 * the score, words and the resulting board state after applying pending tiles.
 */
export function prepareSubmitOutcome(
  boardMap: Map<string, PlacedTile>,
  pendingTiles: PlacedTile[],
  deps: MoveDeps
): PreparedSubmit {
  const outcome = computeValidatedMove(boardMap, pendingTiles, deps)
  if (!outcome.ok) {
    return { ok: false, errors: outcome.errors || [] }
  }
  const newBoardState = applyPendingTilesToBoard(boardMap, pendingTiles)
  return { ok: true, score: outcome.score, words: outcome.newWords.map(w => w.word), newBoardState }
}
