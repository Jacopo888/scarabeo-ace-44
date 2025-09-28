import { Tile } from '@/types/game'
import { canEndGame, calculateEndGamePenalty } from '@/utils/gameRules'

export const shouldEndGameAfterMove = (
  player1Rack: Tile[],
  player2Rack: Tile[],
  remainingBag: Tile[]
) =>
  canEndGame(
    [
      { rack: player1Rack },
      { rack: player2Rack },
    ],
    remainingBag,
    0
  )

export const applyEndgamePenalties = (
  player1Score: number,
  player2Score: number,
  player1Rack: Tile[],
  player2Rack: Tile[]
) => {
  let p1 = player1Score
  let p2 = player2Score
  const p1Penalty = calculateEndGamePenalty(player1Rack)
  const p2Penalty = calculateEndGamePenalty(player2Rack)
  p1 -= p1Penalty
  p2 -= p2Penalty
  if (p1 > p2) {
    p1 += p2Penalty
  } else if (p2 > p1) {
    p2 += p1Penalty
  }
  return { p1, p2 }
}
