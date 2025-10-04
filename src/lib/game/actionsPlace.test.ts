import { describe, it, expect } from 'vitest'
import { applyPlaceTile } from './actionsPlace'
import type { GameState, Tile } from '@/types/game'
import { createEmptyBoard } from '@/core/board'

const makeState = (over: Partial<GameState> = {}): GameState => ({
  boardMatrix: createEmptyBoard(),
  players: [
    { id: 'p1', name: 'P1', score: 0, rack: [], isBot: false },
    { id: 'p2', name: 'P2', score: 0, rack: [], isBot: true }
  ],
  currentPlayerIndex: 0,
  tileBag: [],
  gameStatus: 'playing',
  passCounts: [0, 0],
  ...over,
})

const tile = (letter: string, points = 1): Tile => ({ letter, points })

describe('applyPlaceTile', () => {
  it('does nothing if square occupied', () => {
    const matrix = createEmptyBoard()
    matrix[7][7] = { letter: 'A', points: 1, row: 7, col: 7 }
    const st = makeState({ boardMatrix: matrix })
    const res = applyPlaceTile(st, 7,7, tile('B'))
    expect(res.didPlace).toBe(false)
    expect(res.next).toBe(st)
  })

  it('does nothing if tile not in rack', () => {
    const st = makeState({ players: [{ id: 'p1', name: 'P1', score: 0, rack: [tile('X')], isBot: false }, { id: 'p2', name: 'P2', score: 0, rack: [], isBot: true }] })
    const res = applyPlaceTile(st, 7,7, tile('A'))
    expect(res.didPlace).toBe(false)
    expect(res.next).toBe(st)
  })

  it('removes tile from rack and returns pending tile', () => {
    const st = makeState({ players: [{ id: 'p1', name: 'P1', score: 0, rack: [tile('A')], isBot: false }, { id: 'p2', name: 'P2', score: 0, rack: [], isBot: true }] })
    const res = applyPlaceTile(st, 7,7, tile('A'))
    expect(res.didPlace).toBe(true)
    expect(res.addedPending).toBeTruthy()
    expect(res.next.players[0].rack.length).toBe(0)
  })
})
