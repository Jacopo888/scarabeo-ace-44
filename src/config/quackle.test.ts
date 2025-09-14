import { describe, it, expect, vi, beforeEach } from 'vitest'

function setHost(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { hostname },
    writable: true,
  })
}

describe('QUACKLE_SERVICE_URL selection', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('uses localhost when no env and host is local', async () => {
    setHost('localhost')
    ;(import.meta as any).env = { ...(import.meta as any).env, VITE_QUACKLE_SERVICE_URL: '' }
    const mod = await import('./quackle')
    expect(mod.QUACKLE_SERVICE_URL).toBe('http://localhost:5000')
  })

  it('uses Railway when no env and host is not local', async () => {
    setHost('example.com')
    ;(import.meta as any).env = { ...(import.meta as any).env, VITE_QUACKLE_SERVICE_URL: '' }
    const mod = await import('./quackle')
    expect(mod.QUACKLE_SERVICE_URL).toBe('https://service-quackle-production.up.railway.app')
  })
})

