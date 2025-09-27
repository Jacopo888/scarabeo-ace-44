import { describe, it, expect } from 'vitest'
import { computeFinalPlayers } from './endgame'

describe('computeFinalPlayers', () => {
  it('awards leftover points to the winner (p1 wins)', () => {
    const players = [
      { id: 'p1', name: 'P1', score: 50, rack: [], isBot: false },
      { id: 'p2', name: 'P2', score: 40, rack: [{ letter: 'A', points: 1, isBlank: false }], isBot: true }
    ]
    const res = computeFinalPlayers(players as any)
    // p2 penalty = 1, so p2 base = 39; p1 > p2, p1 gets +1 leftover
    expect(res[0].score).toBe(51)
    expect(res[1].score).toBe(39)
  })

  it('awards leftover points to the winner (p2 wins)', () => {
    const players = [
      { id: 'p1', name: 'P1', score: 40, rack: [{ letter: 'A', points: 1, isBlank: false }], isBot: false },
      { id: 'p2', name: 'P2', score: 50, rack: [], isBot: true }
    ]
    const res = computeFinalPlayers(players as any)
    // p1 penalty = 1, so p1 base = 39; p2 > p1, p2 gets +1 leftover
    expect(res[0].score).toBe(39)
    expect(res[1].score).toBe(51)
  })

  it('keeps scores on tie (no award)', () => {
    const players = [
      { id: 'p1', name: 'P1', score: 40, rack: [{ letter: 'A', points: 1, isBlank: false }], isBot: false },
      { id: 'p2', name: 'P2', score: 40, rack: [{ letter: 'B', points: 1, isBlank: false }], isBot: true }
    ]
    const res = computeFinalPlayers(players as any)
    // penalties 1 each => 39 vs 39, equal after penalties, no award applied
    expect(res[0].score).toBe(39)
    expect(res[1].score).toBe(39)
  })
})
