import { describe, it, expect } from 'vitest'
import { applyMove, canPlace, createEmptyBoard, scoreMove, CENTER, BOARD_SIZE } from './board'
import { PlacedTile } from '@/types/game'

function makeTile(letter: string, row: number, col: number, points: number, isBlank = false): PlacedTile {
  return { letter, row, col, points, isBlank }
}

describe('board core', () => {
  it('rejects out of bounds and overlap', () => {
    const board = createEmptyBoard()
    const move = [makeTile('A', -1, 0, 1)]
    expect(canPlace(board, move)).toEqual({ ok: false, reason: 'out_of_bounds' })

    const b2 = applyMove(board, [makeTile('A', CENTER, CENTER, 1)])
    const move2 = [makeTile('B', CENTER, CENTER, 3)]
    expect(canPlace(b2, move2)).toEqual({ ok: false, reason: 'overlap' })
  })

  it('first move must cover center', () => {
  const board = createEmptyBoard()
  const move = [makeTile('A', CENTER, CENTER + 1, 1)]
  expect(canPlace(board, move)).toEqual({ ok: false, reason: 'must_cover_center' })
  expect(canPlace(board, [makeTile('A', CENTER, CENTER, 1)])).toEqual({ ok: true })
  })

  it('enforces alignment and contiguity on line', () => {
  let board = createEmptyBoard()
    // First move on star
    board = applyMove(board, [makeTile('A', CENTER, CENTER, 1)])

    // Misaligned
    const moveMis = [makeTile('B', CENTER, CENTER + 1, 3), makeTile('C', CENTER + 1, CENTER + 2, 3)]
    expect(canPlace(board, moveMis)).toEqual({ ok: false, reason: 'not_aligned' })

    // Horizontal with gap: place at c+2 leaving c+1 empty (no existing tile there)
    const moveGap = [makeTile('B', CENTER, CENTER + 2, 3)]
    expect(canPlace(board, moveGap)).toEqual({ ok: false, reason: 'must_connect' }) // not touching anything
  })

  it('scores simple horizontal word with DW at center', () => {
    let board = createEmptyBoard()
    const move = [
      makeTile('C', CENTER, CENTER - 1, 3),
      makeTile('A', CENTER, CENTER, 1), // STAR=DW applies to new tile only
      makeTile('T', CENTER, CENTER + 1, 1),
    ]
    expect(canPlace(board, move)).toEqual({ ok: true })
    const { score, words } = scoreMove(board, move)
    // Letter multipliers: default 1. Word multiplier: STAR at center doubles the word (only for the new center tile).
    // Base = 3 + 1 + 1 = 5, DW => 10
    expect(score).toBe(10)
    expect(words[0]).toBe('CAT')
    board = applyMove(board, move)
  })

  it('scores cross words with letter multipliers', () => {
    let board = createEmptyBoard()
    // First place on center to enable connections
    board = applyMove(board, [makeTile('A', CENTER, CENTER, 1)])
    // Place vertical move through a DL/TL case to ensure only the new tile gets multiplier
    // Use a spot known for DL: (7,3) is DL from constants; build a cross there.
    // Construct horizontal base "AT" from (7,6) to (7,7) already has A at center (7,7). We place T at (7,6)
    const tMove: PlacedTile[] = [makeTile('T', CENTER, CENTER - 1, 1)]
    expect(canPlace(board, tMove)).toEqual({ ok: true })
    board = applyMove(board, tMove)

    // Now play vertical on column 3 to hit DL at (7,3)
    // Pre-fill neighbors to create a word crossing at (7,3)
    // Place H at (6,3) and E at (8,3) on separate turns via board to simulate existing tiles
    board = applyMove(board, [makeTile('H', CENTER - 1, 3, 4)])
    board = applyMove(board, [makeTile('E', CENTER + 1, 3, 1)])
    // Now place new tile at (7,3) which is DL; word formed is H ? E vertically; letter at (7,3) say 'O'(1) doubled
    const crossMove: PlacedTile[] = [makeTile('O', CENTER, 3, 1)]
    expect(canPlace(board, crossMove)).toEqual({ ok: true })
    const res = scoreMove(board, crossMove)
    // Vertical word HOE: H(4) + O(1*2 DL) + E(1) = 4 + 2 + 1 = 7
    expect(res.score).toBe(7)
    expect(res.words).toContain('HOE')
  })

  it('awards bingo for 7 tiles', () => {
    const board = createEmptyBoard()
    const letters = [
      ['S', 1], ['T', 1], ['R', 1], ['A', 1], ['N', 1], ['G', 2], ['E', 1],
    ] as const
    const move: PlacedTile[] = letters.map((l, i) => ({ letter: l[0], points: l[1], row: CENTER, col: CENTER - 3 + i }))
    // ensure star included
    expect(move.some(t => t.row === CENTER && t.col === CENTER)).toBe(true)
    expect(canPlace(board, move)).toEqual({ ok: true })
    const { score } = scoreMove(board, move)
    // Base points: 1+1+1+1+1+2+1 = 8; STAR at center doubles word => 16; +50 bingo => 66
    expect(score).toBe(66)
  })
})
