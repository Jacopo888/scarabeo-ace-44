import type { Player } from '@/types/game'
import { calculateEndGamePenalty } from '@/utils/gameRules'

// Compute final players' scores applying rack penalties and awarding leftover points
// Assumes a 2-player game, preserving the existing tie behavior (no additional award on tie).
export function computeFinalPlayers(players: Player[]): Player[] {
  if (players.length !== 2) return players

  const p1Penalty = calculateEndGamePenalty(players[0].rack)
  const p2Penalty = calculateEndGamePenalty(players[1].rack)

  let p1Score = players[0].score - p1Penalty
  let p2Score = players[1].score - p2Penalty

  if (p1Score > p2Score) {
    p1Score += p2Penalty
  } else if (p2Score > p1Score) {
    p2Score += p1Penalty
  }

  return [
    { ...players[0], score: p1Score },
    { ...players[1], score: p2Score }
  ]
}
