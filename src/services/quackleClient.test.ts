import { describe, it, expect, vi, beforeEach } from 'vitest'

import { quackleBestMove } from './quackleClient'

describe('quackleClient error propagation and logging', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('propagates CORS/Network errors and logs { url, err }', async () => {
    const fetchMock = vi.fn().mockImplementation(() => { throw new TypeError('Failed to fetch') })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // @ts-ignore
    global.fetch = fetchMock

    const payload = { board: {}, rack: [], difficulty: 'easy' }
    let thrown: any = null
    try {
      await quackleBestMove(payload)
    } catch (e) { thrown = e }

    expect(thrown).toBeTruthy()
    const calls = errorSpy.mock.calls
    const hasStructuredLog = calls.some(c => c[0] && typeof c[0] === 'object' && c[0].tag === 'quackle_fetch_error' && typeof c[0].url === 'string')
    expect(hasStructuredLog).toBe(true)

    errorSpy.mockRestore()
  })
})

