import { describe, it, expect } from 'vitest'
import type { GameState } from '@/types/game'
import { getCurrentPlayer, isCurrentPlayerTurn, nextPlayerIndex } from './turns'

const baseState = (): GameState => ({
  board: new Map(),
  players: [],
  currentPlayerIndex: 0,
  tileBag: [],
  gameStatus: 'waiting',
  gameMode: 'human',
  passCounts: [0, 0]
})

describe('turns helpers', () => {
  it('getCurrentPlayer returns undefined when no players', () => {
    const s = baseState()
    expect(getCurrentPlayer(s)).toBeUndefined()
  })

  it('isCurrentPlayerTurn checks player id', () => {
    const s = baseState()
    s.players = [
      { id: 'p1', name: 'A', score: 0, rack: [] },
      { id: 'p2', name: 'B', score: 0, rack: [] }
    ]
    s.currentPlayerIndex = 1
    expect(isCurrentPlayerTurn(s, 'p2')).toBe(true)
    expect(isCurrentPlayerTurn(s, 'p1')).toBe(false)
  })

  it('nextPlayerIndex wraps around', () => {
    const s = baseState()
    s.players = [
      { id: 'p1', name: 'A', score: 0, rack: [] },
      { id: 'p2', name: 'B', score: 0, rack: [] }
    ]
    s.currentPlayerIndex = 1
    expect(nextPlayerIndex(s)).toBe(0)
    s.currentPlayerIndex = 0
    expect(nextPlayerIndex(s)).toBe(1)
  })
})
