import { describe, expect, it } from 'vitest'
import type { GameRecord } from '@/types/multiplayer'
import { buildGameState, gameRecordStatusToGameStatus } from './state'

const baseGame: GameRecord = {
  id: 'g1',
  player1_id: 'u1',
  player2_id: 'u2',
  current_player_id: 'u1',
  status: 'active',
  board_state: {},
  tile_bag: [],
  player1_rack: [],
  player2_rack: [],
  player1_score: 10,
  player2_score: 20,
  turn_duration: '24h',
  pass_count: 0,
  created_at: '2026-06-10T00:00:00.000Z',
  updated_at: '2026-06-10T00:00:00.000Z',
}

describe('multiplayer state builder', () => {
  it.each([
    ['waiting', 'waiting'],
    ['active', 'playing'],
    ['completed', 'finished'],
    ['abandoned', 'finished'],
  ] as const)('maps Supabase status %s to GameState status %s', (recordStatus, gameStatus) => {
    expect(gameRecordStatusToGameStatus(recordStatus)).toBe(gameStatus)
  })

  it('only marks the user turn playable for active games', () => {
    expect(buildGameState({ ...baseGame, status: 'active' }, 'u1').isMyTurn).toBe(true)
    expect(buildGameState({ ...baseGame, status: 'completed' }, 'u1').isMyTurn).toBe(false)
    expect(buildGameState({ ...baseGame, status: 'abandoned' }, 'u1').isMyTurn).toBe(false)
    expect(buildGameState({ ...baseGame, status: 'waiting' }, 'u1').isMyTurn).toBe(false)
  })
})
