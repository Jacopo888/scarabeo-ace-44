import { describe, it, expect } from 'vitest'
import { sanitizeQuackleTile } from './tiles'
import type { PlacedTile } from '@/types/game'

const base = (over: Partial<PlacedTile>): PlacedTile => ({
  letter: 'A', points: 1, isBlank: false, row: 0, col: 0, ...over
})

describe('sanitizeQuackleTile', () => {
  it('normalizes letter case and preserves 0-based coords', () => {
    const t = sanitizeQuackleTile(base({ letter: 'a', row: 7, col: 7 }))!
    expect(t.letter).toBe('A')
    expect(t.row).toBe(7)
    expect(t.col).toBe(7)
  })

  it('filters placeholder and invalid letters', () => {
    expect(sanitizeQuackleTile(base({ letter: '.' }))).toBeNull()
    expect(sanitizeQuackleTile(base({ letter: '', row: 3, col: 3 }))).toBeNull()
  })

  it('treats ? as blank and zeroes points', () => {
    const t = sanitizeQuackleTile(base({ letter: '?', points: 5, row: 1, col: 1 }))!
    expect(t.isBlank).toBe(true)
    expect(t.points).toBe(0)
  })

  it('rejects out-of-bounds coordinates (0-based)', () => {
    expect(sanitizeQuackleTile(base({ row: -1 }))).toBeNull()
    expect(sanitizeQuackleTile(base({ col: -1 }))).toBeNull()
    expect(sanitizeQuackleTile(base({ row: 15 }))).toBeNull()
    expect(sanitizeQuackleTile(base({ col: 15 }))).toBeNull()
  })

  it('rejects non-integer coordinates', () => {
    expect(sanitizeQuackleTile(base({ row: 1.2 as unknown as number }))).toBeNull()
    expect(sanitizeQuackleTile(base({ col: Number.NaN }))).toBeNull()
  })
})
