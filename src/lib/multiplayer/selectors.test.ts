import { describe, it, expect } from 'vitest'
import { getOpponentInfo, getMyScore, getCurrentRack } from './selectors'

describe('multiplayer selectors', () => {
  const baseGame = {
    id: 'g1',
    status: 'playing',
    player1_id: 'u1',
    player2_id: 'u2',
    player1_score: 10,
    player2_score: 20,
    player1_rack: [
      { letter: 'A', points: 1, isBlank: false },
      { letter: 'B', points: 3, isBlank: false },
    ],
    player2_rack: [
      { letter: 'C', points: 3, isBlank: false },
      { letter: ' ', points: 0, isBlank: true },
    ],
    board_state: {},
    tile_bag: [],
    current_player_id: 'u1',
    pass_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    player1: { id: 'u1', username: 'p1', display_name: 'P1' },
    player2: { id: 'u2', username: 'p2', display_name: 'P2' },
  } as any

  it('getOpponentInfo returns opponent basics', () => {
    expect(getOpponentInfo(baseGame, 'u1')).toEqual({ id: 'u2', name: 'P2', score: 20 })
    expect(getOpponentInfo(baseGame, 'u2')).toEqual({ id: 'u1', name: 'P1', score: 10 })
  })

  it('getMyScore returns proper score for user', () => {
    expect(getMyScore(baseGame, 'u1')).toBe(10)
    expect(getMyScore(baseGame, 'u2')).toBe(20)
  })

  it('getCurrentRack subtracts pending placements with blanks and duplicates', () => {
    const pending1 = [{ row: 7, col: 7, letter: 'A', points: 1, isBlank: false }]
    expect(getCurrentRack(baseGame, 'u1', pending1)).toEqual([{ letter: 'B', points: 3, isBlank: false }])

    const pending2 = [{ row: 7, col: 7, letter: ' ', points: 0, isBlank: true }]
    expect(getCurrentRack(baseGame, 'u2', pending2)).toEqual([{ letter: 'C', points: 3, isBlank: false }])
  })
})
