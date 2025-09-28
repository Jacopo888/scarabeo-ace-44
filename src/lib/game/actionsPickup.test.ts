import { describe, it, expect } from 'vitest'
import { applyPickupTile } from './actionsPickup'
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

describe('applyPickupTile', () => {
  it('no-op if tile not found in pending', () => {
    const st = makeState()
    const res = applyPickupTile(st, 7,7, [])
    expect(res.didPickup).toBe(false)
    expect(res.next).toBe(st)
  })

  it('returns tile to rack and signals removal from pending', () => {
    const st = makeState()
    const pending = [pt('A',7,7), pt('?',7,8,true)]
    const res = applyPickupTile(st, 7,7, pending)
    expect(res.didPickup).toBe(true)
    expect(res.pickedTile?.row).toBe(7)
    expect(res.next.players[0].rack.length).toBe(1)
  })
})
