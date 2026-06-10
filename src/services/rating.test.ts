import { describe, expect, it, vi, afterEach } from 'vitest'
import type { GameRecord } from '@/types/multiplayer'

const game: GameRecord = {
  id: 'game-1',
  player1_id: '11111111-1111-4111-8111-111111111111',
  player2_id: '22222222-2222-4222-8222-222222222222',
  current_player_id: '11111111-1111-4111-8111-111111111111',
  status: 'completed',
  winner_id: '11111111-1111-4111-8111-111111111111',
  board_state: {},
  tile_bag: [],
  player1_rack: [],
  player2_rack: [],
  player1_score: 120,
  player2_score: 90,
  turn_duration: '1h',
  pass_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('reportGameResult', () => {
  it('sends Supabase UUIDs as strings instead of numeric coercions', async () => {
    vi.stubEnv('VITE_RATING_API_URL', 'https://rating.example.test')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { reportGameResult } = await import('./rating')
    await reportGameResult(game, game.winner_id)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      player1Id: game.player1_id,
      player2Id: game.player2_id,
      winnerId: game.winner_id,
      mode: 'blitz',
    })
  })

  it('sends null winnerId for draws', async () => {
    vi.stubEnv('VITE_RATING_API_URL', 'https://rating.example.test')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { reportGameResult } = await import('./rating')
    await reportGameResult({ ...game, winner_id: undefined }, null)

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body)).winnerId).toBeNull()
  })
})
