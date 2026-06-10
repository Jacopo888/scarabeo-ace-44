import { describe, expect, it } from 'vitest'
import { gameParticipantFilters, isGameForUser } from './realtime'

describe('multiplayer realtime helpers', () => {
  it('builds one Supabase Realtime filter per participant column', () => {
    const filters = gameParticipantFilters('user-123')

    expect(filters).toEqual([
      'player1_id=eq.user-123',
      'player2_id=eq.user-123',
    ])
    expect(filters.every((filter) => !filter.includes(','))).toBe(true)
  })

  it('checks if an inserted game belongs to the current user', () => {
    const game = { player1_id: 'u1', player2_id: 'u2' }

    expect(isGameForUser(game, 'u1')).toBe(true)
    expect(isGameForUser(game, 'u2')).toBe(true)
    expect(isGameForUser(game, 'u3')).toBe(false)
  })
})
