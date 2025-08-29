import { describe, it, expect } from 'vitest'
import { validateMoveLogic } from './moveValidation'
import type { PlacedTile } from '@/types/game'

describe('validateMoveLogic', () => {
  it('allows separated tiles bridged by existing tiles', () => {
    const board = new Map<string, PlacedTile>()
    const pTile: PlacedTile = { row: 7, col: 7, letter: 'P', points: 3 }
    board.set('7,7', pTile)

    const nTile: PlacedTile = { row: 7, col: 6, letter: 'N', points: 1 }
    const eTile: PlacedTile = { row: 7, col: 8, letter: 'E', points: 1 }

    const result = validateMoveLogic(board, [nTile, eTile])
    expect(result.isValid).toBe(true)
    expect(result.errors).not.toContain('All new tiles must be adjacent to each other')
  })

  it('validates moves with blank tiles assigned a letter', () => {
    const board = new Map<string, PlacedTile>()

    const blankTile: PlacedTile = { row: 7, col: 7, letter: 'A', points: 0, isBlank: true }

    const result = validateMoveLogic(board, [blankTile])

    expect(result.isValid).toBe(true)
  })
})
