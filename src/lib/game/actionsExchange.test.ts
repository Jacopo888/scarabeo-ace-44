import { describe, it, expect } from 'vitest'
import { applyExchangeTiles } from './actionsExchange'
import type { GameState } from '@/types/game'

const makeState = (over: Partial<GameState> = {}): GameState => ({
  board: new Map(),
  players: [
    { id: 'p1', name: 'P1', score: 0, rack: [{ letter: 'A', points: 1 } as any], isBot: false },
    { id: 'p2', name: 'P2', score: 0, rack: [{ letter: 'B', points: 3 } as any], isBot: true }
  ],
  currentPlayerIndex: 0,
  tileBag: [],
  gameStatus: 'playing',
  passCounts: [0, 0],
  ...over,
})

describe('applyExchangeTiles', () => {
  it('does nothing if bag has fewer tiles than rack size', () => {
    const st = makeState({ tileBag: [{ letter: 'C', points: 3 } as any] })
    const next = applyExchangeTiles(st)
    expect(next).toBe(st)
  })

  it('exchanges all rack tiles and advances turn when possible', () => {
    const st = makeState({ tileBag: [{ letter: 'C', points: 3 } as any, { letter: 'D', points: 2 } as any] })
    const next = applyExchangeTiles(st)
    expect(next.players[0].rack.length).toBe(1) // rack size preserved
    expect(next.currentPlayerIndex).toBe(1)
    expect(next.passCounts?.[0]).toBe(0)
    expect(next.tileBag.length).toBeGreaterThanOrEqual(0)
  })
})
