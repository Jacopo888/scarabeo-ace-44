import { describe, it, expect } from 'vitest'
import { summarizeMoveInfo } from './moveUtils'

describe('game/moveUtils summarizeMoveInfo', () => {
  it('extracts words array when present', () => {
    const input = { words: ['HELLO', 'WORLD'], score: 10 }
    const out = summarizeMoveInfo(input)
    expect(out.words).toEqual(['HELLO', 'WORLD'])
    expect(out.score).toBe(10)
  })

  it('wraps single word field into array', () => {
    const input = { word: 'SOLO', score_earned: 7 }
    const out = summarizeMoveInfo(input)
    expect(out.words).toEqual(['SOLO'])
    expect(out.score).toBe(7)
  })

  it('defaults score to 0 when missing', () => {
    const input = { words: ['A'] }
    const out = summarizeMoveInfo(input)
    expect(out.words).toEqual(['A'])
    expect(out.score).toBe(0)
  })
})
