import { describe, it, expect } from 'vitest'
import { applyPassTurn } from './actions'
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

describe('applyPassTurn', () => {
  it('increments pass count and switches turn when not ending', () => {
    const state = makeState({ tileBag: [{ letter: 'A', points: 1 } as any] })
    const next = applyPassTurn(state)
    expect(next.passCounts?.[0]).toBe(1)
    expect(next.currentPlayerIndex).toBe(1)
    expect(next.gameStatus).toBe('playing')
  })

  it('finishes the game when both players have passed twice', () => {
    const state = makeState({ passCounts: [1, 1], currentPlayerIndex: 0, tileBag: [{ letter: 'A', points: 1 } as any] })
    const mid = applyPassTurn(state)
    // p1 passes -> [2,1], not finished yet because not both >=2
    expect(mid.gameStatus).toBe('playing')
    const end = applyPassTurn({ ...mid, currentPlayerIndex: 1 })
    expect(end.gameStatus).toBe('finished')
  })

  it('finishes if a rack is empty and bag is empty (endgame rule)', () => {
    const state = makeState({ tileBag: [], players: [
      { id: 'p1', name: 'P1', score: 0, rack: [], isBot: false },
      { id: 'p2', name: 'P2', score: 0, rack: [{ letter: 'B', points: 1 } as any], isBot: true }
    ] })
    const next = applyPassTurn(state)
    expect(next.gameStatus).toBe('finished')
  })
})
