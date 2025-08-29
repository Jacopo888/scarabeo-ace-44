import { describe, it, expect } from 'vitest'
import { calculateWordScore, calculateMoveScore } from './scoring'

const hTile = { row: 7, col: 7, letter: 'H', points: 4 }
const iTile = { row: 7, col: 8, letter: 'I', points: 1 }
const tTile = { row: 8, col: 8, letter: 'T', points: 1 }

const hiWord = {
  word: 'HI',
  tiles: [hTile, iTile],
  direction: 'horizontal' as const,
  startRow: 7,
  startCol: 7,
}

const itWord = {
  word: 'IT',
  tiles: [iTile, tTile],
  direction: 'vertical' as const,
  startRow: 7,
  startCol: 8,
}

describe('calculateWordScore', () => {
  it('calculates score without multipliers', () => {
    const tiles = [
      { row: 7, col: 4, letter: 'H', points: 4 },
      { row: 7, col: 5, letter: 'I', points: 1 },
    ]

    const word = {
      word: 'HI',
      tiles,
      direction: 'horizontal' as const,
      startRow: 7,
      startCol: 4,
    }

    expect(calculateWordScore(word, tiles)).toBe(5)
  })

  it('applies letter and word multipliers', () => {
    const tiles = [
      { row: 0, col: 0, letter: 'Q', points: 10 },
      { row: 0, col: 1, letter: 'U', points: 1 },
      { row: 0, col: 2, letter: 'I', points: 1 },
      { row: 0, col: 3, letter: 'Z', points: 10 },
    ]

    const word = {
      word: 'QUIZ',
      tiles,
      direction: 'horizontal' as const,
      startRow: 0,
      startCol: 0,
    }

    expect(calculateWordScore(word, tiles)).toBe(96)
  })
})

describe('calculateMoveScore', () => {
  it('sums word scores without bonus', () => {
    const expected = calculateWordScore(hiWord, [hTile, iTile, tTile]) +
      calculateWordScore(itWord, [hTile, iTile, tTile])

    expect(calculateMoveScore([hiWord, itWord], [hTile, iTile, tTile])).toBe(expected)
  })

  it('adds bingo bonus for seven tiles', () => {
    const tiles = [
      { row: 0, col: 1, letter: 'A', points: 1 },
      { row: 0, col: 2, letter: 'B', points: 2 },
      { row: 0, col: 3, letter: 'C', points: 2 }, // DL
      { row: 0, col: 4, letter: 'D', points: 2 },
      { row: 0, col: 5, letter: 'E', points: 1 },
      { row: 0, col: 6, letter: 'F', points: 4 },
      { row: 0, col: 7, letter: 'G', points: 2 }, // TW
    ]

    const word = {
      word: 'ABCDEFG',
      tiles,
      direction: 'horizontal' as const,
      startRow: 0,
      startCol: 1,
    }

    const score = calculateMoveScore([word], tiles)
    expect(score).toBe(98)
  })
})
