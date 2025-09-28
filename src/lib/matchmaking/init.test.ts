import { describe, it, expect } from 'vitest'
import { createInitialDeal, type InitialDealDeps } from './init'
import type { Tile } from '@/types/game'

const tile = (L: string, P = 1, B = false): Tile => ({ letter: L, points: P, isBlank: B })

describe('matchmaking/createInitialDeal', () => {
  it('deals 7 tiles to each player and leaves the rest in bag', () => {
    const dist: Tile[] = [
      tile('A'), tile('B'), tile('C'), tile('D'), tile('E'), tile('F'), tile('G'),
      tile('H'), tile('I'), tile('J'), tile('K'), tile('L'), tile('M'), tile('N'),
    ]
    const deps: InitialDealDeps = {
      shuffleArray: <T,>(arr: T[]) => arr, // identity for determinism
      drawTiles: (bag, n) => ({ drawn: bag.slice(0, n), remaining: bag.slice(n) })
    }

    const { player1Rack, player2Rack, initialTileBag } = createInitialDeal(dist, deps)
    expect(player1Rack).toHaveLength(7)
    expect(player2Rack).toHaveLength(7)
    expect(initialTileBag).toHaveLength(dist.length - 14)
    expect(player1Rack.map(t => t.letter)).toEqual(['A','B','C','D','E','F','G'])
    expect(player2Rack.map(t => t.letter)).toEqual(['H','I','J','K','L','M','N'])
  })
})
