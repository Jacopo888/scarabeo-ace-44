import { describe, it, expect, vi } from 'vitest'
import { quackleHealth } from './quackleClient'

describe('quackleHealth error mapping', () => {
  it('maps CORS/network errors to CORS_ERROR', async () => {
    const orig = globalThis.fetch as any
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    try {
      const res = await quackleHealth()
      expect(res.ok).toBe(false)
      expect(res.error).toBe('CORS_ERROR')
    } finally {
      globalThis.fetch = orig
    }
  })
})

