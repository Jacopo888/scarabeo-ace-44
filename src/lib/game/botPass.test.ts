import { describe, it, expect } from 'vitest'
import { shouldPassBotMove } from './botPass'

describe('shouldPassBotMove', () => {
  it('returns true when move is null/undefined', () => {
    expect(shouldPassBotMove(null as any, [])).toBe(true)
    expect(shouldPassBotMove(undefined as any, [])).toBe(true)
  })
  it('returns true when move_type is pass', () => {
    expect(shouldPassBotMove({ move_type: 'pass' }, [])).toBe(true)
  })
  it('returns true when sanitizedTiles is empty', () => {
    expect(shouldPassBotMove({ move_type: 'place' }, [])).toBe(true)
  })
  it('returns false when move is place and has tiles', () => {
    expect(shouldPassBotMove({ move_type: 'place' }, [{ row: 7, col: 7, letter: 'A', isBlank: false, points: 1 } as any])).toBe(false)
  })
})
