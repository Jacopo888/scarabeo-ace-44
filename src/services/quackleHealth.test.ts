import { describe, it, expect, vi } from 'vitest'
import { quackleHealth } from './quackleClient'

describe('quackleHealth error mapping', () => {
  it('requires engine_ready=true even when HTTP status is ok', async () => {
    const orig = globalThis.fetch as any
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      engine_ready: false,
      strategy_ready: true,
      binary_present: true
    }), { status: 200 }))
    try {
      const res = await quackleHealth()
      expect(res.ok).toBe(false)
      expect(res.status).toBe(200)
      expect(res.engineReady).toBe(false)
      expect(res.data?.engine_ready).toBe(false)
    } finally {
      globalThis.fetch = orig
    }
  })

  it('reports ok when HTTP status is ok and engine is ready', async () => {
    const orig = globalThis.fetch as any
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      engine_ready: true,
      strategy_ready: true,
      binary_present: true
    }), { status: 200 }))
    try {
      const res = await quackleHealth()
      expect(res.ok).toBe(true)
      expect(res.engineReady).toBe(true)
    } finally {
      globalThis.fetch = orig
    }
  })

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

