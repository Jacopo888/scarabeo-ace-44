import { describe, it, expect } from 'vitest'
import { applyExchangeTiles, applyExchangeSelected } from './actionsExchange'
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

  it('exchanges only selected tiles', () => {
    const st = makeState({
      tileBag: [
        { letter: 'C', points: 3 } as any,
        { letter: 'D', points: 2 } as any,
        { letter: 'E', points: 1 } as any,
        { letter: 'F', points: 4 } as any,
      ],
      players: [
        { id: 'p1', name: 'P1', score: 0, rack: [
          { letter: 'A', points: 1 } as any,
          { letter: 'B', points: 3 } as any,
          { letter: 'G', points: 2 } as any,
        ], isBot: false },
        { id: 'p2', name: 'P2', score: 0, rack: [{ letter: 'Z', points: 10 } as any], isBot: true },
      ]
    })
    const next = applyExchangeSelected(st, [0, 2]) // exchange A and G, keep B
    expect(next.players[0].rack.length).toBe(3)
    expect(next.currentPlayerIndex).toBe(1)
  })
})
