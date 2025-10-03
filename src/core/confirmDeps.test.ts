import { describe, it, expect } from 'vitest'
import { makeCoreConfirmDeps } from './confirmDeps'
import type { PlacedTile } from '@/types/game'

const key = (r: number, c: number) => `${r},${c}`
const T = (l: string, r: number, c: number, p: number): PlacedTile => ({ letter: l, row: r, col: c, points: p })

describe('core confirm deps', () => {
  const isValidWord = (_w: string) => true
  const deps = makeCoreConfirmDeps(isValidWord)

  it('invalid: first move must cover center', () => {
    const board = new Map<string, PlacedTile>()
    const move = [T('A', 7, 8, 1)]
    const res = deps.validateMoveLogic(board, move)
    expect(res.isValid).toBe(false)
    expect(res.errors[0]).toBeDefined()
  })

  it('valid: connects to existing tile and single line', () => {
    const board = new Map<string, PlacedTile>([[key(7,7), T('A', 7, 7, 1)]])
    const move = [T('T', 7, 6, 1)] // touches A on the right
    const res = deps.validateMoveLogic(board, move)
    expect(res.isValid).toBe(true)
  })

  it('findNewWordsFormed: builds main word across existing tiles', () => {
    // Existing: A at center, we add T left and E right → ATE
    const board = new Map<string, PlacedTile>([[key(7,7), T('A', 7, 7, 1)]])
    const move = [T('T', 7, 6, 1), T('E', 7, 8, 1)]
    const words = deps.findNewWordsFormed(board, move)
    const list = words.map(w => w.word)
    expect(list).toContain('TAE')
  })
})
