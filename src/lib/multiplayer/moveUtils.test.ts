import { describe, it, expect } from 'vitest'
import { computeValidatedMove, applyPendingTilesToBoard, type MoveDeps } from './moveUtils'
import type { PlacedTile } from '@/types/game'
import { createEmptyBoard, Board } from '@/core/board'

const makeTile = (row: number, col: number, letter: string, points = 1, isBlank = false): PlacedTile => ({
  row,
  col,
  letter,
  points,
  isBlank
})

describe('multiplayer/moveUtils', () => {
  it('computeValidatedMove returns errors when validation fails', () => {
  const board: Board = createEmptyBoard()
    const pending = [makeTile(7, 7, 'A')]
    const deps: MoveDeps = {
      validateMoveLogic: () => ({ isValid: false, errors: ['not_contiguous'] }),
      findNewWordsFormed: () => [{ word: 'A' }],
      calculateScore: () => 10,
      isValidWord: () => true
    }

    const out = computeValidatedMove(board, pending, deps)
    expect(out.ok).toBe(false)
    expect(out.errors).toEqual(['not_contiguous'])
    expect(out.newWords).toEqual([])
    expect(out.score).toBe(0)
  })

  it('computeValidatedMove rejects when new words contain invalid entries', () => {
  const board: Board = createEmptyBoard()
    const pending = [makeTile(7, 7, 'B')]
    const deps: MoveDeps = {
      validateMoveLogic: () => ({ isValid: true, errors: [] }),
      findNewWordsFormed: () => [{ word: 'BAD' }, { word: 'OK' }],
      calculateScore: () => 20,
      isValidWord: w => w !== 'BAD'
    }

    const out = computeValidatedMove(board, pending, deps)
    expect(out.ok).toBe(false)
    expect(out.errors).toEqual(['BAD'])
    expect(out.newWords).toEqual([])
    expect(out.score).toBe(0)
  })

  it('computeValidatedMove returns ok with score when everything is valid', () => {
  const board: Board = createEmptyBoard()
  board[7][6] = makeTile(7, 6, 'C')
    const pending = [makeTile(7, 7, 'A'), makeTile(7, 8, 'T')]
    const deps: MoveDeps = {
      validateMoveLogic: () => ({ isValid: true, errors: [] }),
      findNewWordsFormed: () => [{ word: 'CAT' }],
      calculateScore: () => 42,
      isValidWord: () => true
    }

    const out = computeValidatedMove(board, pending, deps)
    expect(out.ok).toBe(true)
    expect(out.errors).toBeUndefined()
    expect(out.newWords).toEqual([{ word: 'CAT' }])
    expect(out.score).toBe(42)
  })

  it('applyPendingTilesToBoard returns a plain object with row,col keys', () => {
  const board: Board = createEmptyBoard()
    const pending = [makeTile(1, 2, 'A'), makeTile(3, 4, 'B')]

  const result = applyPendingTilesToBoard(board, pending)
    expect(Object.keys(result).sort()).toEqual(['1,2', '3,4'])
    expect(result['1,2']).toMatchObject({ row: 1, col: 2, letter: 'A' })
    expect(result['3,4']).toMatchObject({ row: 3, col: 4, letter: 'B' })
  })
})
