import { describe, it, expect, vi, beforeEach } from 'vitest'

import { quackleBestMove } from './quackleClient'

describe('quackleClient error propagation and logging', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('propagates CORS/Network errors (logs are gated by debug flag)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => { throw new TypeError('Failed to fetch') })
    // @ts-ignore
    global.fetch = fetchMock

    const payload = { board: {}, rack: [], difficulty: 'easy' }
    let thrown: any = null
    try {
      await quackleBestMove(payload)
    } catch (e) { thrown = e }

    expect(thrown).toBeTruthy()
    expect(thrown.message).toContain('CORS/Network')
    // Note: structured logs are now gated by VITE_DEBUG_QUACKLE, so we don't assert on console.error calls
  })
})

