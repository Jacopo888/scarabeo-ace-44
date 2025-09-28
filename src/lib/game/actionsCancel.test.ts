import { describe, it, expect } from 'vitest'
import { applyCancelMove } from './actionsCancel'
import type { GameState, PlacedTile } from '@/types/game'

const makeState = (over: Partial<GameState> = {}): GameState => ({
  board: new Map(),
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

const pt = (letter: string, row: number, col: number, isBlank = false): PlacedTile => ({ letter, points: isBlank ? 0 : 1, row, col, isBlank }) as any

describe('applyCancelMove', () => {
  it('no-op when no pending tiles', () => {
    const st = makeState()
    const next = applyCancelMove(st, [])
    expect(next).toBe(st)
  })

  it('returns pending tiles to current player rack and keeps state otherwise', () => {
    const st = makeState()
    const pending = [pt('A',7,7), pt('?',7,8,true)]
    const next = applyCancelMove(st, pending)
    expect(next.players[0].rack.length).toBe(2)
    expect(next.players[0].rack[1].letter).toBe('') // blank reset
    expect(next.currentPlayerIndex).toBe(0)
    expect(next.gameStatus).toBe('playing')
  })
})
