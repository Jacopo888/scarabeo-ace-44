import { describe, it, expect, vi } from 'vitest'
import { formatRack, formatMove, logQuackleMove, logPlayerMove, logPlayerAction } from './debugLogger'
import type { Tile, PlacedTile } from '@/types/game'
import type { QuackleMove } from '@/services/quackleClient'

describe('debugLogger', () => {
  describe('formatRack', () => {
    it('formats string rack', () => {
      expect(formatRack('HELLO')).toBe('HELLO')
    })

    it('formats tile array rack', () => {
      const rack: Tile[] = [
        { letter: 'H', points: 4, isBlank: false },
        { letter: 'E', points: 1, isBlank: false },
        { letter: 'L', points: 1, isBlank: false }
      ]
      expect(formatRack(rack)).toBe('HEL')
    })

    it('formats blank tiles with brackets', () => {
      const rack: Tile[] = [
        { letter: 'A', points: 0, isBlank: true },
        { letter: 'B', points: 1, isBlank: false }
      ]
      expect(formatRack(rack)).toBe('[A]B')
    })
  })

  describe('formatMove', () => {
    it('formats play move', () => {
      const tiles: PlacedTile[] = [
        { row: 7, col: 7, letter: 'H', points: 4, isBlank: false },
        { row: 7, col: 8, letter: 'I', points: 1, isBlank: false }
      ]
      expect(formatMove(tiles, ['HI'], 10)).toBe('HI (HI) → 10 pts')
    })

    it('returns PASS for empty tiles', () => {
      expect(formatMove([], [], 0)).toBe('PASS')
    })

    it('formats blank tiles with brackets', () => {
      const tiles: PlacedTile[] = [
        { row: 7, col: 7, letter: 'A', points: 0, isBlank: true }
      ]
      expect(formatMove(tiles, ['AT'], 5)).toBe('AT ([A]) → 5 pts')
    })
  })

  describe('logQuackleMove', () => {
    it('logs valid move', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const move: QuackleMove = {
        tiles: [{ row: 7, col: 7, letter: 'A', points: 1, isBlank: false }],
        score: 10,
        words: ['AT'],
        move_type: 'play'
      }
      logQuackleMove('AEIRST', move)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🤖 Quackle'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AEIRST'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AT'))
    })

    it('logs pass move', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const move: QuackleMove = {
        tiles: [],
        score: 0,
        words: [],
        move_type: 'pass'
      }
      logQuackleMove('ZZZZZ', move)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PASS'))
    })
  })

  describe('logPlayerMove', () => {
    it('logs player move', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const rack: Tile[] = [{ letter: 'H', points: 4, isBlank: false }]
      const tiles: PlacedTile[] = [{ row: 7, col: 7, letter: 'H', points: 4, isBlank: false }]
      logPlayerMove('Alice', rack, tiles, ['HI'], 10)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('👤 Alice'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('H'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('10 pts'))
    })
  })

  describe('logPlayerAction', () => {
    it('logs pass action', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const rack: Tile[] = [{ letter: 'Z', points: 10, isBlank: false }]
      logPlayerAction('Bob', rack, 'pass')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('👤 Bob'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PASS'))
    })

    it('logs exchange action', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const rack: Tile[] = [{ letter: 'X', points: 8, isBlank: false }]
      logPlayerAction('Carol', rack, 'exchange', 3)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('EXCHANGE'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('3'))
    })
  })
})
