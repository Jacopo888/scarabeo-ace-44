import { describe, it, expect } from 'vitest'
import { validateMoveLogic } from './moveValidation'
import { createEmptyBoard, Board } from '@/core/board'
import type { PlacedTile } from '@/types/game'

describe('validateMoveLogic', () => {
  it('allows separated tiles bridged by existing tiles', () => {
  const board: Board = createEmptyBoard()
  const pTile: PlacedTile = { row: 7, col: 7, letter: 'P', points: 3 }
  board[7][7] = pTile

    const nTile: PlacedTile = { row: 7, col: 6, letter: 'N', points: 1 }
    const eTile: PlacedTile = { row: 7, col: 8, letter: 'E', points: 1 }

    const result = validateMoveLogic(board, [nTile, eTile])
    expect(result.isValid).toBe(true)
    expect(result.errors).not.toContain('All new tiles must be adjacent to each other')
  })

  it('validates moves with blank tiles assigned a letter', () => {
  const board: Board = createEmptyBoard()

    const blankTile: PlacedTile = { row: 7, col: 7, letter: 'A', points: 0, isBlank: true }

    const result = validateMoveLogic(board, [blankTile])

    expect(result.isValid).toBe(true)
  })

  it('requires first move to cover center', () => {
  const board: Board = createEmptyBoard()
    const tile: PlacedTile = { row: 0, col: 0, letter: 'A', points: 1 }
    const result = validateMoveLogic(board, [tile])
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('First move must cover the center square')
  })

  it('rejects tiles not in a single row or column', () => {
  const board: Board = createEmptyBoard()
    const a: PlacedTile = { row: 7, col: 7, letter: 'A', points: 1 }
    const b: PlacedTile = { row: 8, col: 9, letter: 'B', points: 3 }
    const result = validateMoveLogic(board, [a, b])
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Tiles must be placed in a single row or column')
  })

  it('requires adjacency to existing tiles when board not empty', () => {
  const board: Board = createEmptyBoard()
  board[7][7] = { row: 7, col: 7, letter: 'A', points: 1 }
    const t: PlacedTile = { row: 0, col: 0, letter: 'B', points: 3 }
    const result = validateMoveLogic(board, [t])
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('New tiles must be adjacent to existing tiles')
  })

  it('cannot place a tile on an occupied square', () => {
  const board: Board = createEmptyBoard()
  board[5][5] = { row: 5, col: 5, letter: 'C', points: 3 }
    const t: PlacedTile = { row: 5, col: 5, letter: 'D', points: 2 }
    const result = validateMoveLogic(board, [t])
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Cannot place tile on occupied square')
  })
})
