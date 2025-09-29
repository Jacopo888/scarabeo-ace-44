import { describe, it, expect } from 'vitest'
import type { GameState, Tile } from '@/types/game'
import { getCurrentRack, reshuffleRack, withCurrentRack } from './rack'

const mkState = (rack: Tile[] = []): GameState => ({
  board: new Map(),
  players: [{ id: 'p1', name: 'A', score: 0, rack }],
  currentPlayerIndex: 0,
  tileBag: [],
  gameStatus: 'waiting',
  gameMode: 'human',
  passCounts: [0]
})

const tile = (l: string): Tile => ({ letter: l, points: 1 })

describe('rack helpers', () => {
  it('getCurrentRack clones the rack', () => {
    const s = mkState([tile('A'), tile('B')])
    const r = getCurrentRack(s)
    expect(r).toEqual(s.players[0].rack)
    expect(r).not.toBe(s.players[0].rack)
  })

  it('reshuffleRack returns a new array', () => {
    const r = [tile('A'), tile('B'), tile('C')]
    const shuffled = reshuffleRack(r)
    expect(shuffled).toHaveLength(3)
    expect(shuffled).not.toBe(r)
    // It could by chance be equal, but length/identity checks suffice here.
  })

  it('withCurrentRack updates players immutably', () => {
    const s = mkState([tile('A')])
    const players = withCurrentRack(s, [tile('Z')])
    expect(players).toHaveLength(1)
    expect(players[0].rack[0].letter).toBe('Z')
    // original state not mutated
    expect(s.players[0].rack[0].letter).toBe('A')
  })
})
