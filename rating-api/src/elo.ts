export type Mode = 'blitz' | 'rapid' | 'async'

export function kFactor(mode: Mode): number {
  switch (mode) {
    case 'blitz':
      return 32
    case 'rapid':
      return 24
    case 'async':
      return 16
    default:
      return 32
  }
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

export function calculateElo(
  ratingA: number,
  ratingB: number,
  winner: 'A' | 'B' | 'draw',
  mode: Mode,
): { newRatingA: number; newRatingB: number } {
  const k = kFactor(mode)
  const expA = expectedScore(ratingA, ratingB)
  const expB = expectedScore(ratingB, ratingA)
  const scoreA = winner === 'A' ? 1 : winner === 'B' ? 0 : 0.5
  const scoreB = winner === 'B' ? 1 : winner === 'A' ? 0 : 0.5
  const newRatingA = Math.round(ratingA + k * (scoreA - expA))
  const newRatingB = Math.round(ratingB + k * (scoreB - expB))
  return { newRatingA, newRatingB }
}
