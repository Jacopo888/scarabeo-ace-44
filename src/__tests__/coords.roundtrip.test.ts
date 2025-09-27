import { describe, it, expect } from 'vitest'
import payload from '../../fixtures/coords/test_payload.json'
import { algebraicToZeroCoord, zeroToAlgebraic, zeroToOneString, oneStringToZero } from '../lib/coords'

describe('coords round-trip', () => {
  it('algebraic <-> zero-based and one-string <-> zero-based', () => {
    expect(payload.boardSize).toBe(15)
    for (const c of payload.cases as Array<{ alg: string; one: string; zero: [number, number] }>) {
      const z = algebraicToZeroCoord(c.alg)
      expect(z).toEqual(c.zero)
      expect(zeroToAlgebraic(z)).toBe(c.alg)
      expect(oneStringToZero(c.one)).toEqual(c.zero)
      expect(zeroToOneString(z)).toBe(c.one)
    }
  })
})
