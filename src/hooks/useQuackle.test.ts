import { describe, it, expect } from 'vitest'
import { buildQuackleBoard } from './useQuackle'

describe('buildQuackleBoard', () => {
  it('converts to 1-based keys; bounds are validated server-side', () => {
    const gameState: any = {
      board: new Map([
        ['0,0', { row: 0, col: 0, letter: 'A', points: 1 }],
        ['16,0', { row: 16, col: 0, letter: 'B', points: 3 }],
        ['0,16', { row: 0, col: 16, letter: 'C', points: 3 }],
        ['14,14', { row: 14, col: 14, letter: 'Z', points: 10 }],
      ])
    }
    const out = buildQuackleBoard(gameState)
    const keys = Object.keys(out)
    // FE does not filter; it just converts to 1-based. Service will validate bounds.
    expect(keys).toContain('1,1')
    expect(keys).toContain('15,15')
    expect(keys.length).toBe(4)
  })
})
