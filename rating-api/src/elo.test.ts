import { describe, it, expect } from 'vitest'
import { calculateElo } from './elo'

describe('calculateElo', () => {
  it('blitz win updates ratings with k=32', () => {
    const res = calculateElo(1000, 1000, 'A', 'blitz')
    expect(res.newRatingA).toBe(1016)
    expect(res.newRatingB).toBe(984)
  })

  it('rapid draw leaves ratings unchanged', () => {
    const res = calculateElo(1200, 1200, 'draw', 'rapid')
    expect(res.newRatingA).toBe(1200)
    expect(res.newRatingB).toBe(1200)
  })
})
