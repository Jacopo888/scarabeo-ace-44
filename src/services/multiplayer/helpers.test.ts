import { describe, it, expect } from 'vitest'
import { nextPlayerId, opponentId, evaluateEndgameAfterMove, evaluateEndgameOnPass, winnerIdFromTag } from './helpers'
import type { Tile } from '@/types/game'

describe('multiplayer helpers', () => {
  it('nextPlayerId and opponentId work as expected', () => {
    const game = { player1_id: 'u1', player2_id: 'u2', current_player_id: 'u1' } as any
    expect(nextPlayerId(game)).toBe('u2')
    expect(opponentId(game, 'u1')).toBe('u2')
    expect(opponentId(game, 'u2')).toBe('u1')
  })

  it('evaluateEndgameAfterMove returns no end when bag not empty and racks not empty', () => {
    const rack1: Tile[] = [{ letter: 'A', points: 1, isBlank: false }]
    const rack2: Tile[] = [{ letter: 'B', points: 3, isBlank: false }]
    const remaining: Tile[] = [{ letter: 'C', points: 3, isBlank: false }]
    const res = evaluateEndgameAfterMove({
      player1Score: 10,
      player2Score: 8,
      player1Rack: rack1,
      player2Rack: rack2,
      remainingBag: remaining,
    })
    expect(res.endGame).toBe(false)
    expect(res.winnerId).toBeNull()
    expect(res.player1Score).toBe(10)
    expect(res.player2Score).toBe(8)
  })

  it('evaluateEndgameAfterMove returns end and winner p1 when p1 empties rack and bag empty', () => {
    const rack1: Tile[] = []
    const rack2: Tile[] = [{ letter: 'A', points: 1, isBlank: false }]
    const remaining: Tile[] = []
    const res = evaluateEndgameAfterMove({
      player1Score: 10,
      player2Score: 8,
      player1Rack: rack1,
      player2Rack: rack2,
      remainingBag: remaining,
    })
    expect(res.endGame).toBe(true)
    expect(res.winnerId).toBe('p1')
    // p1 should gain opponent penalty (likely 1) after both penalties applied
    expect(res.player1Score).toBeGreaterThan(10)
  })

  it('evaluateEndgameOnPass ends when passCount >= 4 with tie when scores and racks equal', () => {
    const rack1: Tile[] = []
    const rack2: Tile[] = []
    const bag: Tile[] = [{ letter: 'Z', points: 10, isBlank: false }]
    const res = evaluateEndgameOnPass({
      passCount: 4,
      player1Score: 7,
      player2Score: 7,
      player1Rack: rack1,
      player2Rack: rack2,
      tileBag: bag,
    })
    expect(res.endGame).toBe(true)
    expect(res.winnerId).toBeNull()
    expect(res.player1Score).toBe(7)
    expect(res.player2Score).toBe(7)
  })

  it('winnerIdFromTag maps correctly to real ids', () => {
    const game = { player1_id: 'u1', player2_id: 'u2' } as any
    expect(winnerIdFromTag(game, 'p1')).toBe('u1')
    expect(winnerIdFromTag(game, 'p2')).toBe('u2')
    expect(winnerIdFromTag(game, null)).toBeNull()
  })
})
