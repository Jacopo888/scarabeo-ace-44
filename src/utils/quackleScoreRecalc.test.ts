import { describe, it, expect } from 'vitest'
import { recalculateQuackleScore } from './quackleScoreRecalc'
import type { PlacedTile } from '@/types/game'

describe('recalculateQuackleScore', () => {
  it('calculates score for JIN at center (7,7) with DW multiplier', () => {
    const tiles: PlacedTile[] = [
      { row: 7, col: 7, letter: 'J', points: 8, isBlank: false },
      { row: 7, col: 8, letter: 'I', points: 1, isBlank: false },
      { row: 7, col: 9, letter: 'N', points: 1, isBlank: false }
    ]
    const board = new Map<string, PlacedTile>()
    
    // J(8) + I(1) + N(1) = 10, × 2 (DW at center) = 20
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(20)
  })

  it('calculates score for DJIN at center with DW multiplier', () => {
    const tiles: PlacedTile[] = [
      { row: 7, col: 6, letter: 'D', points: 2, isBlank: false },
      { row: 7, col: 7, letter: 'J', points: 8, isBlank: false },
      { row: 7, col: 8, letter: 'I', points: 1, isBlank: false },
      { row: 7, col: 9, letter: 'N', points: 1, isBlank: false }
    ]
    const board = new Map<string, PlacedTile>()
    
    // D(2) + J(8) + I(1) + N(1) = 12, × 2 (DW at center) = 24
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(24)
  })

  it('calculates score for word at Triple Word Score corner', () => {
    const tiles: PlacedTile[] = [
      { row: 0, col: 0, letter: 'C', points: 3, isBlank: false },
      { row: 0, col: 1, letter: 'A', points: 1, isBlank: false },
      { row: 0, col: 2, letter: 'T', points: 1, isBlank: false }
    ]
    const board = new Map<string, PlacedTile>()
    
    // C(3) + A(1) + T(1) = 5, × 3 (TW at 0,0) = 15
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(15)
  })

  it('calculates score with Double Letter Score', () => {
    const tiles: PlacedTile[] = [
      { row: 0, col: 3, letter: 'Z', points: 10, isBlank: false }, // DL
      { row: 0, col: 4, letter: 'O', points: 1, isBlank: false },
      { row: 0, col: 5, letter: 'O', points: 1, isBlank: false }
    ]
    const board = new Map<string, PlacedTile>()
    
    // Z(10×2) + O(1) + O(1) = 22
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(22)
  })

  it('calculates score with Triple Letter Score', () => {
    const tiles: PlacedTile[] = [
      { row: 1, col: 5, letter: 'Q', points: 10, isBlank: false }, // TL
      { row: 1, col: 6, letter: 'I', points: 1, isBlank: false }
    ]
    const board = new Map<string, PlacedTile>()
    
    // Q(10×3) + I(1) = 31
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(31)
  })

  it('does not apply multipliers to existing board tiles', () => {
    const tiles: PlacedTile[] = [
      { row: 7, col: 8, letter: 'I', points: 1, isBlank: false },
      { row: 7, col: 9, letter: 'N', points: 1, isBlank: false }
    ]
    const board = new Map<string, PlacedTile>([
      ['7,7', { row: 7, col: 7, letter: 'J', points: 8, isBlank: false }]
    ])
    
    // J(8) already on board (no multiplier applied to it)
    // + I(1, no special square) + N(1, no special square) = 10 total
    // But since the new tiles don't trigger DW (J is already there), score = 10
    // Actually: full word is JIN (8+1+1=10), but center DW was already used
    // New tiles don't sit on special squares, so: 10 (no mult)
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(10)
  })

  it('adds 50 point bonus for using all 7 tiles (BINGO)', () => {
    const tiles: PlacedTile[] = [
      { row: 7, col: 7, letter: 'Q', points: 10, isBlank: false },  // DW
      { row: 7, col: 8, letter: 'U', points: 1, isBlank: false },
      { row: 7, col: 9, letter: 'A', points: 1, isBlank: false },
      { row: 7, col: 10, letter: 'C', points: 3, isBlank: false },
      { row: 7, col: 11, letter: 'K', points: 5, isBlank: false },  // DL
      { row: 7, col: 12, letter: 'E', points: 1, isBlank: false },
      { row: 7, col: 13, letter: 'D', points: 2, isBlank: false }   // DW
    ]
    const board = new Map<string, PlacedTile>()
    
    // Q(10) + U(1) + A(1) + C(3) + K(5×2 DL) + E(1) + D(2) = 10+1+1+3+10+1+2 = 28
    // × 2 (DW at 7,7) × 2 (DW at 7,13) = 28 × 4 = 112... wait that's not right
    // Actually DW multipliers multiply once per word, not stack: 28 × 2 × 2 = 112
    // No wait, let me recalculate: we have DW at (7,7) and DW at (7,13)
    // Both are ON the word, so: base 28, × 2 × 2 = 112 - 6 (wrong calculation in expected)
    // Let me check special squares: 7,11 is DL, 7,7 is DW, 7,13 is DW
    // Score = (10 + 1 + 1 + 3 + 5×2 + 1 + 2) × 2 × 2 + 50 = 28 × 4 + 50 = 112 + 50 = 162
    // But checking constants: 7,13 is DW. So we have 2 DW multipliers!
    // Let me simplify and recalculate properly:
    // Base: Q(10) + U(1) + A(1) + C(3) + K(5*2=10 at 7,11 DL) + E(1) + D(2) = 28
    // Word multipliers: DW at 7,7 (*2) and DW at 7,13 (*2) = *4 total
    // 28 * 4 = 112, + 50 (bingo) = 162... but this seems wrong
    // Actually let me check: the function might not multiply DW twice
    // Looking at my code, wordMultiplier *= 2 for each DW
    // So if we hit 2 DW squares: mult = 1 * 2 * 2 = 4
    // Expected: (10+1+1+3+10+1+2) * 4 + 50 = 28*4+50 = 112+50 = 162
    // But the test expected 96... let me recalc without assuming 7,13 is DW
    // Checking my constants: 7,13 is indeed listed as DW
    // So the test expectation was wrong. Let me check tiles again:
    // Position 7,11 is DL (correct), 7,13 is DW (correct)
    // But wait: the word spans 7,7 to 7,13 which is only 7 columns
    // With K at 7,11 (DL) and D at 7,13 (DW), and Q at 7,7 (DW)
    // Actual calc: Q(10) U(1) A(1) C(3) K(5*2) E(1) D(2) = 28 base
    // Multipliers: *2 (from 7,7) *2 (from 7,13) = *4
    // 28*4 = 112, +50 = 162
    // I think the expected value in the test is wrong. The function returns 106.
    // Let me trace through: oh wait, maybe 7,13 is NOT DW?
    // Checking my SPECIAL_SQUARES: "13,1": "DW", "13,13": "DW" (not 7,13)
    // So 7,13 is NOT a special square! Only 7,7 is DW.
    // Recalc: (10 + 1 + 1 + 3 + 10 + 1 + 2) * 2 + 50 = 28*2+50 = 56+50 = 106
    // So the function is correct! The test expected value is wrong.
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(106)  // Fixed: 28 base * 2 (DW at 7,7) + 50 (bingo) = 106
  })

  it('returns 0 for empty tiles array', () => {
    const tiles: PlacedTile[] = []
    const board = new Map<string, PlacedTile>()
    
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(0)
  })

  it('handles blank tiles (zero points)', () => {
    const tiles: PlacedTile[] = [
      { row: 7, col: 7, letter: 'A', points: 0, isBlank: true },
      { row: 7, col: 8, letter: 'T', points: 1, isBlank: false }
    ]
    const board = new Map<string, PlacedTile>()
    
    // A(0) + T(1) = 1, × 2 (DW at center) = 2
    const score = recalculateQuackleScore(tiles, board)
    expect(score).toBe(2)
  })
})
