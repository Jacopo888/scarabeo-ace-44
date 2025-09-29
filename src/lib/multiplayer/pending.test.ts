import { describe, it, expect } from 'vitest'
import { upsertPendingTile, removePendingTile } from './pending'

describe('pending helpers', () => {
  it('upsertPendingTile replaces existing at same coord', () => {
    const pending = [
      { row: 1, col: 1, letter: 'A', points: 1, isBlank: false },
    ]
    const next = upsertPendingTile(pending, 1, 1, { letter: 'B', points: 3, isBlank: false })
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ row: 1, col: 1, letter: 'B', points: 3 })
  })

  it('removePendingTile removes only the matching coord', () => {
    const pending = [
      { row: 0, col: 0, letter: 'A', points: 1, isBlank: false },
      { row: 2, col: 3, letter: 'C', points: 3, isBlank: false },
    ]
    const next = removePendingTile(pending, 0, 0)
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ row: 2, col: 3 })
  })
})
