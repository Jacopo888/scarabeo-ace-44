import { describe, it, expect } from 'vitest'
import payload from '../../fixtures/coords/test_payload.json'
import { toServiceCoord, fromServiceCoord } from '../lib/coords'

describe('coords round-trip', () => {
  it('0-based <-> service coord_map_1based', () => {
    expect(payload.boardSize).toBe(15)
    for (const c of payload.cases as Array<{ alg: string; one: string; zero: [number, number] }>) {
      const [r, c0] = c.zero
      const key = toServiceCoord(r, c0)
      expect(key).toBe(c.one)
      const back = fromServiceCoord(key)
      expect([back.row, back.col]).toEqual(c.zero)
    }
  })
})
