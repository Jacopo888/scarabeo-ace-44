import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('EngineStatusBadge', () => {
  it('renders message when simulating', async () => {
    vi.resetModules()
    vi.doMock('@/contexts/QuackleContext', () => ({
      useQuackleContext: () => ({
        lastEngineInfo: {
          hl_strict: true,
          path: 'hl' as const,
          kibitz_len: 20,
          status: 'simulating' as const,
          used_simulator: true,
        }
      })
    }))
    const { default: Badge } = await import('@/components/EngineStatusBadge')
    render(<Badge />)
    expect(screen.queryByText(/Montecarlo Simulations/i)).toBeTruthy()
  })

  it('renders nothing when not simulating', async () => {
    vi.resetModules()
    vi.doMock('@/contexts/QuackleContext', () => ({
      useQuackleContext: () => ({
        lastEngineInfo: {
          hl_strict: true,
          path: 'hl' as const,
          kibitz_len: 5,
          status: 'static' as const,
          used_simulator: false,
        }
      })
    }))
    const { default: Badge } = await import('@/components/EngineStatusBadge')
    const { container } = render(<Badge />)
    expect(container).toBeEmptyDOMElement()
  })
})
