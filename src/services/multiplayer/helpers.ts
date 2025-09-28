import type { GameRecord } from '@/types/multiplayer'
import type { PlacedTile, Tile } from '@/types/game'
import { shouldEndGameAfterMove, applyEndgamePenalties } from '@/lib/multiplayer/endgame'

export type MoveLogEntry =
  | ({
      move_type: 'place_tiles'
      score_earned?: number
      tiles_placed?: PlacedTile[]
      words_formed?: string[]
      board_state_after?: Record<string, PlacedTile>
      rack_after?: Tile[]
    })
  | ({
      move_type: 'exchange_tiles'
      score_earned?: number
      tiles_exchanged?: Tile[]
      board_state_after?: Record<string, PlacedTile>
      rack_after?: Tile[]
    })
  | ({
      move_type: 'pass' | 'resign'
      score_earned?: number
      board_state_after?: Record<string, PlacedTile>
      rack_after?: Tile[]
    })

export function nextPlayerId(game: GameRecord): string {
  return game.current_player_id === game.player1_id ? game.player2_id : game.player1_id
}

export function opponentId(game: GameRecord, userId: string): string {
  return game.player1_id === userId ? game.player2_id : game.player1_id
}

export function evaluateEndgameAfterMove(args: {
  player1Score: number
  player2Score: number
  player1Rack: Tile[]
  player2Rack: Tile[]
  remainingBag: Tile[]
}): { endGame: boolean; player1Score: number; player2Score: number; winnerId: 'p1' | 'p2' | null } {
  const endGame = shouldEndGameAfterMove(args.player1Rack, args.player2Rack, args.remainingBag)
  if (!endGame) {
    return { endGame: false, player1Score: args.player1Score, player2Score: args.player2Score, winnerId: null }
  }
  const { p1, p2 } = applyEndgamePenalties(
    args.player1Score,
    args.player2Score,
    args.player1Rack,
    args.player2Rack
  )
  const winnerId: 'p1' | 'p2' | null = p1 > p2 ? 'p1' : p2 > p1 ? 'p2' : null
  return { endGame: true, player1Score: p1, player2Score: p2, winnerId }
}

export function evaluateEndgameOnPass(args: {
  passCount: number
  player1Score: number
  player2Score: number
  player1Rack: Tile[]
  player2Rack: Tile[]
  tileBag: Tile[]
}): { endGame: boolean; player1Score: number; player2Score: number; winnerId: 'p1' | 'p2' | null } {
  const endOnPasses = args.passCount >= 4
  const endOnBagOrRacks = shouldEndGameAfterMove(args.player1Rack, args.player2Rack, args.tileBag)
  const endGame = endOnPasses || endOnBagOrRacks
  if (!endGame) {
    return { endGame: false, player1Score: args.player1Score, player2Score: args.player2Score, winnerId: null }
  }
  const { p1, p2 } = applyEndgamePenalties(
    args.player1Score,
    args.player2Score,
    args.player1Rack,
    args.player2Rack
  )
  const winnerId: 'p1' | 'p2' | null = p1 > p2 ? 'p1' : p2 > p1 ? 'p2' : null
  return { endGame: true, player1Score: p1, player2Score: p2, winnerId }
}

export function winnerIdFromTag(game: GameRecord, tag: 'p1' | 'p2' | null): string | null {
  if (tag === 'p1') return game.player1_id
  if (tag === 'p2') return game.player2_id
  return null
}

/**
 * Apply endgame results to a game update object in a single place.
 * Mutates the provided update with final scores, status and winner.
 * Returns a compact summary for the caller.
 */
export function applyEndgame(
  game: GameRecord,
  update: Partial<GameRecord>,
  end: { endGame: boolean; player1Score: number; player2Score: number; winnerId: 'p1' | 'p2' | null }
): { endGame: boolean; winnerId: string | null } {
  if (!end.endGame) return { endGame: false, winnerId: null }
  update.status = 'completed'
  update.player1_score = end.player1Score
  update.player2_score = end.player2Score
  update.winner_id = winnerIdFromTag(game, end.winnerId)
  return { endGame: true, winnerId: update.winner_id ?? null }
}
