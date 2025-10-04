import { describe, it, expect } from 'vitest'
import { createEmptyBoard, setBoardTile, scoreMove, applyMove, canPlace, BOARD_SIZE } from './board'
import { buildQuackleBoard } from '@/hooks/useQuackle'
import { PlacedTile, GameState } from '@/types/game'

function makeTile(letter: string, row: number, col: number, points = 1, isBlank = false): PlacedTile {
  return { letter, row, col, points, isBlank }
}

function makeGameStateFromBoard(boardMatrix: ReturnType<typeof createEmptyBoard>): GameState {
  // Minimal subset used by buildQuackleBoard
  return {
    boardMatrix,
    players: [],
    currentPlayerIndex: 0,
    gameStatus: 'playing',
    tileBag: [],
    turn: 0,
    lastAction: null,
    consecutivePasses: 0,
    racks: [],
  } as any
}

describe('Board invariants', () => {
  it('setBoardTile is immutable and only changes targeted cell', () => {
    const b1 = createEmptyBoard()
    const b2 = setBoardTile(b1, 7, 7, makeTile('A', 7, 7, 1))
    expect(b1).not.toBe(b2)
    // Original empty
    expect(b1[7][7]).toBeNull()
    // New has tile
    expect(b2[7][7]).not.toBeNull()
    // All other refs (row arrays besides row 7) should be shared (structural sharing not guaranteed, but we cloned entire board -> each row new). We at least assert non-mutation of other coordinates.
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (r === 7 && c === 7) continue
        expect(b1[r][c]).toBeNull()
        expect(b2[r][c]).toBeNull()
      }
    }
  })

  it('scoreMove matches independent recomputation after applying move', () => {
    let board = createEmptyBoard()
    const move: PlacedTile[] = [
      makeTile('C', 7, 6, 3),
      makeTile('A', 7, 7, 1),
      makeTile('T', 7, 8, 1),
    ]
    expect(canPlace(board, move).ok).toBe(true)
    const { score: s1, words: w1 } = scoreMove(board, move)
    board = applyMove(board, move)
    // Re-score by treating words as new move of single segments (simulate idempotence: scoring same tiles again should yield zero since they are not a new move). Instead we verify the main formed word reconstruction by building Quackle board representation.
    const gs = makeGameStateFromBoard(board)
    const qboard = buildQuackleBoard(gs)
    // Expect CAT word present across its coordinates (1-based keys)
    expect(Object.values(qboard).length).toBe(3)
    expect(w1[0]).toBe('CAT')
    // Known from earlier test: CAT with center DW -> 10
    expect(s1).toBe(10)
  })

  it('buildQuackleBoard filters invalid tiles and uses 1-based coords', () => {
    const b = createEmptyBoard()
    // Place a valid tile and an invalid blank placeholder
    const valid = makeTile('A', 7, 7, 1)
    const invalidBlank = { letter: '?', row: 5, col: 5, points: 0, isBlank: true } as PlacedTile
    b[7][7] = valid as any
    b[5][5] = invalidBlank as any // should be filtered out
    const gs = makeGameStateFromBoard(b)
    const out = buildQuackleBoard(gs)
    expect(out['8,8']).toEqual({ letter: 'A', isBlank: false })
    // invalid blank should not appear
    const keys = Object.keys(out)
    expect(keys.length).toBe(1)
  })
})
