import { describe, it, expect } from 'vitest'
import { QUACKLE_SERVICE_URL, quackleApi } from '@/config/quackle'

describe('quackle config', () => {
  it('builds URLs starting with base', () => {
    const url = quackleApi('/health')
    expect(url.startsWith(QUACKLE_SERVICE_URL)).toBe(true)
  })
})

