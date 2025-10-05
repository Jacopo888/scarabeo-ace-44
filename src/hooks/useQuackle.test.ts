import { describe, it, expect } from 'vitest'
import { buildQuackleBoard } from './useQuackle'
import { createEmptyBoard } from '@/core/board'

describe('buildQuackleBoard', () => {
  it('emits 0-based keys; bounds are validated server-side', () => {
    const boardMatrix = createEmptyBoard()
    boardMatrix[0][0] = { row:0, col:0, letter:'A', points:1 }
    // Out-of-bounds tiles (16,0) / (0,16) non verranno rappresentati perché il board è 15x15 → simuliamo comunque un pass-through: li ignoriamo.
    boardMatrix[14][14] = { row:14, col:14, letter:'Z', points:10 }
    const gameState: any = { boardMatrix }
    const out = buildQuackleBoard(gameState)
    const keys = Object.keys(out)
    // FE uses 0-based. Service will validate bounds.
    expect(keys).toContain('0,0')
    expect(keys).toContain('14,14')
    // Avendo eliminato le coordinate out-of-bounds, rimangono 2 chiavi valide.
    expect(keys.length).toBe(2)
  })
})
