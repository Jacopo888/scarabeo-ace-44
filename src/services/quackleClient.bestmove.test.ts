import { describe, it, expect, vi } from 'vitest'
import { quackleBestMove } from './quackleClient'

describe('quackleBestMove behavior', () => {
  it('throws when engine_fallback=true with error', async () => {
    const originalFetch = globalThis.fetch as any
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ engine_fallback: true, error: 'bridge_failed_rc=70' }),
      text: async () => ''
    } as Response))
    try {
      let thrown: any = null
      try {
        await quackleBestMove({ board: {}, rack: 'AEIRSTZ', difficulty: 'medium' })
      } catch (e) { thrown = e }
      expect(thrown).toBeTruthy()
      expect(String(thrown.message || thrown)).toContain('[bridge]')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns a non-pass move when service responds with tiles', async () => {
    const originalFetch = globalThis.fetch as any
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tiles: [ { row: 7, col: 7, letter: 'A', points: 1, isBlank: false } ],
        score: 4,
        words: ['AR'],
        move_type: 'play',
        engine_fallback: false
      }),
      text: async () => ''
    } as Response))
    try {
      const res = await quackleBestMove({ board: {}, rack: 'AEIRSTZ', difficulty: 'easy' })
      expect(res.move_type).toBe('play')
      expect(Array.isArray(res.tiles)).toBe(true)
      expect(res.tiles.length).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

