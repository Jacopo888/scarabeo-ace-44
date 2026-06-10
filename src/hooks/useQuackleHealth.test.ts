import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuackleHealth } from './useQuackleHealth'
import type { QuackleHealthResult } from '@/services/quackleClient'

vi.mock('@/services/quackleClient', () => {
  const quackleHealthMock = vi.fn<() => Promise<QuackleHealthResult>>()
  return { quackleHealth: quackleHealthMock }
})

// Access the hoisted mock
const { quackleHealth } = await import('@/services/quackleClient')
const quackleHealthMock = vi.mocked(quackleHealth)

const healthyResult: QuackleHealthResult = {
  ok: true,
  status: 200,
  body: '{"engine_ready":true}',
  base: 'https://service.example.test',
  data: { engine_ready: true },
  engineReady: true
}

const unhealthyResult: QuackleHealthResult = {
  ok: false,
  status: 200,
  body: '{"engine_ready":false}',
  base: 'https://service.example.test',
  data: { engine_ready: false },
  engineReady: false
}

describe('useQuackleHealth', () => {
  it('emits healthy status when the service responds ok', async () => {
  quackleHealthMock.mockResolvedValueOnce(healthyResult)

    const { result } = renderHook(() => useQuackleHealth(1000))

    await waitFor(() => {
      expect(result.current.status).toBe('healthy')
    })

    expect(result.current.result).toEqual(healthyResult)
    expect(typeof result.current.lastCheckedAt).toBe('number')
  })

  it('emits unhealthy status when HTTP is ok but engine is not ready', async () => {
    quackleHealthMock.mockResolvedValueOnce(unhealthyResult)

    const { result } = renderHook(() => useQuackleHealth(1000))

    await waitFor(() => {
      expect(result.current.status).toBe('unhealthy')
    })

    expect(result.current.result?.engineReady).toBe(false)
  })

  it.skip('transitions from unhealthy to healthy on subsequent polls', async () => {
    vi.useFakeTimers()
    try {
      quackleHealthMock.mockResolvedValueOnce(unhealthyResult)
      quackleHealthMock.mockResolvedValueOnce(healthyResult)

  const { result } = renderHook(() => useQuackleHealth(100))

      await waitFor(() => {
        expect(result.current.status).toBe('unhealthy')
      })

      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      await waitFor(() => {
        expect(result.current.status).toBe('healthy')
      })

      expect(result.current.result).toEqual(healthyResult)
    } finally {
      vi.useRealTimers()
    }
  })
})
