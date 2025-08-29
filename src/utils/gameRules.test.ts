import { describe, it, expect } from 'vitest'
import { canEndGame, calculateEndGamePenalty } from './gameRules'
import type { PlacedTile } from '@/types/game'

describe('canEndGame', () => {
  const tile: PlacedTile = { letter: 'A', points: 1, row: 0, col: 0 }

  it('detects empty bag with empty rack', () => {
    expect(canEndGame([{ rack: [] }, { rack: [tile] }], [])).toBe(true)
  })

  it('detects six consecutive passes', () => {
    expect(canEndGame([{ rack: [tile] }, { rack: [tile] }], [tile], 6)).toBe(true)
  })

  it('detects when no moves remain', () => {
    expect(canEndGame([{ rack: [tile] }, { rack: [tile] }], [tile], 0, true)).toBe(true)
  })
})

describe('calculateEndGamePenalty', () => {
  it('applies penalties and awards leftovers', () => {
    const rack1: PlacedTile[] = [{ letter: 'A', points: 1, row: 0, col: 0 }]
    const rack2: PlacedTile[] = [{ letter: 'B', points: 3, row: 0, col: 0 }]
    let p1 = 10
    let p2 = 8
    const p1Penalty = calculateEndGamePenalty(rack1)
    const p2Penalty = calculateEndGamePenalty(rack2)
    p1 -= p1Penalty
    p2 -= p2Penalty
    if (p1 > p2) p1 += p2Penalty
    else if (p2 > p1) p2 += p1Penalty
    expect(p1).toBe(12)
    expect(p2).toBe(5)
  })
})
