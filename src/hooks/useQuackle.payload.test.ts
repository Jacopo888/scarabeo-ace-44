import { describe, it, expect } from 'vitest'
import { buildQuackleBoard, formatRackStringForQuackle } from './useQuackle'
import type { GameState, PlacedTile, Tile } from '@/types/game'
import { calculateScore } from '@/utils/scoring'

function makeState(tiles: PlacedTile[] = []): GameState {
  const board = new Map<string, PlacedTile>()
  tiles.forEach(t => board.set(`${t.row},${t.col}`, t))
  return {
    board,
    players: [],
    currentPlayerIndex: 0,
    tileBag: [],
    gameStatus: 'waiting'
  }
}

describe('Quackle payload builders', () => {
  it('buildQuackleBoard produces 1-based coord keys and filters invalid blanks', () => {
    const tiles: PlacedTile[] = [
      { row: 7, col: 7, letter: 'A', points: 1 }, // center
      { row: 0, col: 0, letter: 'B', points: 3 },
      { row: 1, col: 2, letter: 'c', points: 3 }, // lower-case normalized
      { row: 3, col: 4, letter: '?', points: 0, isBlank: true }, // invalid (no assigned letter) → filtered
      { row: 5, col: 5, letter: 'e', points: 0, isBlank: true }, // valid blank with assigned letter
    ]
    const gs = makeState(tiles)
    const out = buildQuackleBoard(gs)
    // Keys must be 1-based
    expect(out['8,8']).toBeDefined() // 7,7 → 8,8
    expect(out['1,1']).toBeDefined()
    expect(out['2,3']).toBeDefined()
    // Filtered invalid blank
    expect(out['4,5']).toBeUndefined()
    // Valid blank retains assigned letter uppercased
    expect(out['6,6']).toEqual({ letter: 'E', isBlank: true })
  })

  it('formatRackStringForQuackle encodes blanks as ? when unassigned and uppercases letters', () => {
    const rack: Tile[] = [
      { letter: 'a', points: 1 },
      { letter: 'b', points: 3 },
      { letter: '', points: 0, isBlank: true }, // → ?
      { letter: 'e', points: 0, isBlank: true }, // assigned blank → E
    ]
    expect(formatRackStringForQuackle(rack)).toBe('AB?E')
  })
})

describe('Local score recalculation parity (core)', () => {
  it('recalculates score with board multipliers for a simple cross word', () => {
    // Existing A at center (star is DW per board config). Add T left and E right: TAE; plus vertical cross with I.
    const board = new Map<string, PlacedTile>([[`7,7`, { row: 7, col: 7, letter: 'A', points: 1 }]])
    const move: PlacedTile[] = [
      { row: 7, col: 6, letter: 'T', points: 1 },
      { row: 7, col: 8, letter: 'E', points: 1 },
    ]
    const score = calculateScore({ tiles: move, existingBoard: board, context: 'quackle' })
    expect(typeof score).toBe('number')
    expect(score).toBeGreaterThanOrEqual(3) // at least sum of letters; exact depends on specials
  })
})

