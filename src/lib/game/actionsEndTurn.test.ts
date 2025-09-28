import { describe, it, expect } from 'vitest'
import { applyEndTurn } from './actionsEndTurn'
import type { GameState } from '@/types/game'

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

describe('applyEndTurn', () => {
  it('draws tiles up to 7 (bounded by bag) and advances turn', () => {
    const st = makeState({ tileBag: [
      { letter: 'A', points: 1 } as any,
      { letter: 'B', points: 3 } as any,
      { letter: 'C', points: 3 } as any,
    ] })
    const next = applyEndTurn(st)
    expect(next.players[0].rack.length).toBeGreaterThan(0)
    expect(next.currentPlayerIndex).toBe(1)
    expect(next.gameStatus).toBe('playing')
  })

  it('finishes game when endgame condition holds', () => {
    const st = makeState({ tileBag: [], players: [
      { id: 'p1', name: 'P1', score: 0, rack: [], isBot: false },
      { id: 'p2', name: 'P2', score: 0, rack: [{ letter: 'B', points: 3 } as any], isBot: true }
    ] })
    const next = applyEndTurn(st)
    expect(next.gameStatus).toBe('finished')
  })
})
