import { describe, it, expect } from 'vitest'
import type { PlacedTile } from '@/types/game'
import { prepareSubmitOutcome } from './prepare'

const board = new Map<string, PlacedTile>()

describe('prepareSubmitOutcome', () => {
  it('returns ok=false when validation fails', () => {
    const deps = {
      validateMoveLogic: () => ({ isValid: false, errors: ['not contiguous'] }),
      findNewWordsFormed: () => [],
      calculateNewMoveScore: () => 0,
      isValidWord: () => true,
    }
    const res = prepareSubmitOutcome(board, [], deps)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.errors).toContain('not contiguous')
    }
  })

  it('returns board, score, words when valid', () => {
    const pending: PlacedTile[] = [
      { row: 7, col: 7, letter: 'A', points: 1, isBlank: false },
      { row: 7, col: 8, letter: 'T', points: 1, isBlank: false },
    ]
    const deps = {
      validateMoveLogic: () => ({ isValid: true, errors: [] }),
      findNewWordsFormed: () => [{ word: 'AT' }],
      calculateNewMoveScore: () => 5,
      isValidWord: () => true,
    }
    const res = prepareSubmitOutcome(board, pending, deps)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.score).toBe(5)
      expect(res.words).toEqual(['AT'])
      expect(Object.keys(res.newBoardState)).toContain('7,7')
      expect(Object.keys(res.newBoardState)).toContain('7,8')
    }
  })
})
