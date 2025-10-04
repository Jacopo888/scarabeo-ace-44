import { describe, it, expect } from 'vitest'
import { createEmptyBoard, applyMove, scoreMove } from './board'
import { calculateScore } from '@/utils/scoring'
import { PlacedTile } from '@/types/game'

const T = (l: string, r: number, c: number, p: number): PlacedTile => ({ letter: l, row: r, col: c, points: p })

describe('integration: scoring core vs calculateScore', () => {
  it('matches score on simple word and crosses', () => {
    // Base board with A at center
    let b = createEmptyBoard()
    b = applyMove(b, [T('A', 7, 7, 1)])

    // New move: add T to the left and E to the right ("ATE")
    const move = [T('T', 7, 6, 1), T('E', 7, 8, 1)]
    const s1 = scoreMove(b, move).score
    const s2 = calculateScore({ tiles: move, board: b })
    expect(s1).toBe(s2)
  })

  it('matches with bingo case', () => {
    const b = createEmptyBoard()
    const letters: [string, number][] = [['S',1],['T',1],['R',1],['A',1],['N',1],['G',2],['E',1]]
    const move = letters.map((x, i) => T(x[0], 7, 4 + i, x[1]))
  const s1 = scoreMove(b, move).score
  const s2 = calculateScore({ tiles: move, board: b })
    expect(s1).toBe(s2)
  })
})
