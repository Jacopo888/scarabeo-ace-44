import { describe, it, expect } from 'vitest'
import type { PlacedTile } from '@/types/game'
import { areNewTilesContiguous } from '../contiguity'
import { areTilesInSingleLine } from '../alignment'
import { areNewTilesAdjacentToBoard } from '../adjacency'
import { areGapsFilledByExistingTiles } from '../gaps'
import { createEmptyBoard, Board } from '@/core/board'
import { coversCenter } from '../center'

const T = (r: number, c: number, ch = 'A', p = 1): PlacedTile => ({ row: r, col: c, letter: ch, points: p })

describe('moveValidation helpers', () => {
  it('contiguity: detects gap when no bridge', () => {
    const tiles = [T(7, 1), T(7, 3)]
    expect(areNewTilesContiguous(tiles)).toBe(false)
  })

  it('single line: rejects L-shape', () => {
    expect(areTilesInSingleLine([T(7, 7), T(8, 9)])).toBe(false)
  })

  it('adjacency: requires touching existing board', () => {
    const board: Board = createEmptyBoard()
    board[7][7] = T(7, 7)
    expect(areNewTilesAdjacentToBoard(board as any, [T(0, 0)])).toBe(false)
    expect(areNewTilesAdjacentToBoard(board as any, [T(7, 6)])).toBe(true)
  })

  it('gaps: allow when bridged by existing tiles', () => {
    const board: Board = createEmptyBoard()
    board[7][2] = T(7, 2)
    expect(areGapsFilledByExistingTiles(board as any, [T(7, 1), T(7, 3)])).toBe(true)
    const empty: Board = createEmptyBoard()
    expect(areGapsFilledByExistingTiles(empty as any, [T(7, 1), T(7, 3)])).toBe(false)
  })

  it('gaps: vertical bridging by existing tiles works', () => {
    const board: Board = createEmptyBoard()
    board[2][7] = T(2, 7)
    expect(areGapsFilledByExistingTiles(board as any, [T(1, 7), T(3, 7)])).toBe(true)
    const empty: Board = createEmptyBoard()
    expect(areGapsFilledByExistingTiles(empty as any, [T(1, 7), T(3, 7)])).toBe(false)
  })

  it('center: true only if any tile is at 7,7', () => {
    expect(coversCenter([T(7, 7)])).toBe(true)
    expect(coversCenter([T(7, 6)])).toBe(false)
  })
})
