import { describe, it, expect } from 'vitest'
import { boardKey, getBoardTile, hasPendingAt, getPendingAt, canPlaceAt, coerceToStoreTile, type AnyBoard } from './board'
import type { PlacedTile, Tile as GameTile } from '@/types/game'
import type { Tile as StoreTile } from '@/store/game'

function makePlaced(letter: string, row: number, col: number, points = 1): PlacedTile {
  return { letter, points, row, col }
}

function makeStore(letter: string, id?: string, value = 1): StoreTile {
  return { id: id ?? `${letter}-id`, letter, value }
}

describe('board helpers', () => {
  it('boardKey produces stable keys', () => {
    expect(boardKey(0, 0)).toBe('0,0')
    expect(boardKey(7, 14)).toBe('7,14')
  })

  it('getBoardTile works with Map board', () => {
    const m = new Map<string, PlacedTile>()
    m.set('1,2', makePlaced('A', 1, 2))
    expect(getBoardTile(m as AnyBoard, 1, 2)).toEqual({ letter: 'A', points: 1, row: 1, col: 2 })
    expect(getBoardTile(m as AnyBoard, 0, 0)).toBeUndefined()
  })

  it('getBoardTile works with matrix board (StoreTile|null)', () => {
    const grid: (StoreTile | null)[][] = Array.from({ length: 15 }, () => Array(15).fill(null))
    grid[3][4] = makeStore('B', 'b-1', 3)
    expect(getBoardTile(grid as AnyBoard, 3, 4)).toEqual({ id: 'b-1', letter: 'B', value: 3 })
    expect(getBoardTile(grid as AnyBoard, 0, 0)).toBeUndefined()
  })

  it('hasPendingAt and getPendingAt detect pending tiles', () => {
    const pending: PlacedTile[] = [makePlaced('C', 5, 5)]
    expect(hasPendingAt(pending, 5, 5)).toBe(true)
    expect(hasPendingAt(pending, 1, 1)).toBe(false)
    expect(getPendingAt(pending, 5, 5)).toEqual({ letter: 'C', points: 1, row: 5, col: 5 })
    expect(getPendingAt(pending, 1, 1)).toBeUndefined()
  })

  it('canPlaceAt respects occupancy from board and pending', () => {
    const grid: (StoreTile | null)[][] = Array.from({ length: 15 }, () => Array(15).fill(null))
    const pending: PlacedTile[] = []

    expect(canPlaceAt(grid as AnyBoard, pending, 0, 0)).toBe(true)
    grid[0][0] = makeStore('D', 'd-1', 2)
    expect(canPlaceAt(grid as AnyBoard, pending, 0, 0)).toBe(false)

    grid[0][0] = null
    pending.push(makePlaced('E', 0, 0))
    expect(canPlaceAt(grid as AnyBoard, pending, 0, 0)).toBe(false)
  })

  it('coerceToStoreTile preserves StoreTile and converts GameTile', () => {
    const s: StoreTile = makeStore('F', 'f-1', 4)
    expect(coerceToStoreTile(s)).toBe(s)

    const g: GameTile = { letter: 'G', points: 2 }
    const coerced = coerceToStoreTile(g)
    expect(coerced.letter).toBe('G')
    expect(coerced.value).toBe(2)
    expect(typeof coerced.id).toBe('string')
  })
})
