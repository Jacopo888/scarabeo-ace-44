import { describe, it, expect } from 'vitest'
import { applyConfirmMove, type ConfirmDeps } from './actionsConfirm'
import type { GameState, PlacedTile, Tile } from '@/types/game'

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

const deps: ConfirmDeps = {
  validateMoveLogic: () => ({ isValid: true, errors: [] }),
  findNewWordsFormed: () => [{ word: 'HI' }],
  calculateScore: () => 5,
  isValidWord: () => true,
}

const tile = (letter: string, row: number, col: number, points = 1): PlacedTile => ({ letter, points, row, col }) as any

describe('applyConfirmMove', () => {
  it('returns error when no pending tiles', () => {
    const res = applyConfirmMove(makeState(), [], deps)
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('empty')
  })

  it('handles invalid move validation', () => {
    const badDeps: ConfirmDeps = { ...deps, validateMoveLogic: () => ({ isValid: false, errors: ['bad'] }) }
    const res = applyConfirmMove(makeState(), [tile('A', 7,7)], badDeps)
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('invalid_move')
    expect(res.error).toContain('bad')
  })

  it('rejects invalid words', () => {
    const badDeps: ConfirmDeps = { ...deps, isValidWord: () => false }
    const res = applyConfirmMove(makeState(), [tile('A',7,7)], badDeps)
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('invalid_words')
  })

  it('applies score, draws tiles, and advances turn on success', () => {
    const bag: Tile[] = [{ letter: 'B', points: 2 } as Tile, { letter: 'C', points: 3 } as Tile]
    const st = makeState({ tileBag: bag, players: [
      { id: 'p1', name: 'P1', score: 0, rack: [{ letter: 'X', points: 8 } as Tile], isBot: false },
      { id: 'p2', name: 'P2', score: 0, rack: [{ letter: 'Y', points: 4 } as Tile], isBot: true },
    ] })
    const res = applyConfirmMove(st, [tile('A',7,7)], deps)
    expect(res.ok).toBe(true)
    const next = res.next!
    expect(next.players[0].score).toBe(5)
    // P1 had 1 tile, should draw up to 7 (limited by bag len=2)
    expect(next.players[0].rack.length).toBe(1 + Math.min(6, bag.length))
    expect(next.currentPlayerIndex).toBe(1)
    expect(next.passCounts?.[0]).toBe(0)
    expect(next.tileBag.length).toBeLessThanOrEqual(bag.length)
    // boardMatrix shadow-write must reflect the placed tile
    expect(next.boardMatrix).toBeTruthy()
    expect(next.boardMatrix![7][7]?.letter).toBe('A')
  })

  it('finishes the game when endgame condition met', () => {
    // Bag empty and player1 rack becomes empty after placing its last tile
    const st = makeState({ tileBag: [], players: [
      { id: 'p1', name: 'P1', score: 0, rack: [], isBot: false },
      { id: 'p2', name: 'P2', score: 0, rack: [{ letter: 'Y', points: 4 } as Tile], isBot: true },
    ] })
    const res = applyConfirmMove(st, [tile('A',7,7)], deps)
    expect(res.ok).toBe(true)
    expect(res.next?.gameStatus).toBe('finished')
    // boardMatrix updated also on finishing state
    expect(res.next?.boardMatrix).toBeTruthy()
    expect(res.next?.boardMatrix?.[7][7]?.letter).toBe('A')
  })
})
