import { describe, it, expect } from 'vitest'
import { decideScore } from './useGame'

describe('decideScore (feature flag scoring)', () => {
  it('usa localScore quando useService=false', () => {
    expect(decideScore({ useService: false, serviceScore: 100, localScore: 42 })).toBe(42)
  })
  it('usa serviceScore quando useService=true', () => {
    expect(decideScore({ useService: true, serviceScore: 100, localScore: 42 })).toBe(100)
  })
  it('propaga zero service se flag attivo', () => {
    expect(decideScore({ useService: true, serviceScore: 0, localScore: 50 })).toBe(0)
  })
  it('preferisce local anche se local=0 quando flag disattivo', () => {
    expect(decideScore({ useService: false, serviceScore: 30, localScore: 0 })).toBe(0)
  })
})
