import { describe, it, expect } from 'vitest'
import type { PlacedTile } from '@/types/game'
import { findAllWords } from '../scan'
import { createEmptyBoard, Board } from '@/core/board'

const T = (r: number, c: number, ch = 'A', p = 1): PlacedTile => ({ row: r, col: c, letter: ch, points: p })

describe('word scanning helper', () => {
  it('finds horizontal and vertical words length > 1', () => {
  const board: Board = createEmptyBoard()
    // Horizontal: CAT at row 7, cols 5-7
    const cat = [T(7, 5, 'C'), T(7, 6, 'A'), T(7, 7, 'T')]
    // Vertical: HI at rows 3-4, col 2
    const hi = [T(3, 2, 'H'), T(4, 2, 'I')]

  for (const t of [...cat, ...hi]) board[t.row][t.col] = t

    const words = findAllWords(board)
    const strings = words.map(w => `${w.direction}:${w.word}@${w.startRow},${w.startCol}`)

    expect(strings).toContain('horizontal:CAT@7,5')
    expect(strings).toContain('vertical:HI@3,2')
    // Single letters are ignored
    expect(strings.some(s => s.includes('A@'))).toBe(false)
  })

  it('handles words at board borders (row 0/14 and col 0/14)', () => {
  const board: Board = createEmptyBoard()
    // Top row border: AB at row 0, cols 0-1
    const top = [T(0, 0, 'A'), T(0, 1, 'B')]
    // Bottom row border: XY at row 14, cols 13-14
    const bottom = [T(14, 13, 'X'), T(14, 14, 'Y')]
    // Left col border: CD at rows 0-1, col 0 (note overlap at 0,0 already used)
    const left = [T(1, 0, 'C'), T(2, 0, 'D')]
    // Right col border: MN at rows 13-14, col 14 (overlap with bottom at 14,14)
    const right = [T(13, 14, 'M'), T(14, 14, 'Y')] // Y reused, acceptable for scan test

  for (const t of [...top, ...bottom, ...left, ...right]) board[t.row][t.col] = t

    const words = findAllWords(board)
    const set = new Set(words.map(w => `${w.direction}:${w.word}@${w.startRow},${w.startCol}`))
    expect(set).toContain('horizontal:AB@0,0')
    expect(set).toContain('horizontal:XY@14,13')
  // Nota: la presenza di 'A' in (0,0) estende verticalmente a 'ACD' da (0,0)
  expect(set).toContain('vertical:ACD@0,0')
    expect(set).toContain('vertical:MY@13,14')
  })
})
