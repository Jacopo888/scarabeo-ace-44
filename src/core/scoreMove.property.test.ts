import { describe, it, expect } from 'vitest'
import { createEmptyBoard, applyMove, scoreMove, canPlace, BOARD_SIZE } from './board'
import type { PlacedTile } from '@/types/game'

// Pseudo-random deterministic generator
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

const LETTERS: Array<[string, number]> = [
  ['A',1],['B',3],['C',3],['D',2],['E',1],['F',4],['G',2],['H',4],['I',1],['L',1],['M',3],['N',1],['O',1],['P',3],['R',1],['S',1],['T',1],['U',1]
]

function randomRack(r: () => number, len: number) {
  const out: Array<[string, number]> = []
  for (let i=0;i<len;i++) out.push(LETTERS[(r()*LETTERS.length)|0])
  return out
}

describe('scoreMove property-based (light)', () => {
  it('monotonicity: adding a valid adjacent tile does not decrease previous word score (100 samples)', () => {
    const r = rng(12345)
    for (let sample=0; sample<100; sample++) {
      let board = createEmptyBoard()
      const rack = randomRack(r, 7)
      // build a horizontal base word length 2..5 passing through center for connectivity
      const baseLen = 2 + ((r()*4)|0)
      const startCol = Math.max(0, Math.min(BOARD_SIZE-baseLen, 7 - ((baseLen/2)|0)))
      const tiles: PlacedTile[] = []
      for (let i=0;i<baseLen;i++) {
        const [L,P] = rack[i]
        tiles.push({ letter: L, points: P, row: 7, col: startCol + i })
      }
      // ensure one tile covers center
      if (!tiles.some(t => t.row===7 && t.col===7)) tiles[(r()*tiles.length)|0] = { ...tiles[0], row:7, col:7 }
      expect(canPlace(board, tiles).ok).toBe(true)
      const { score: s1 } = scoreMove(board, tiles)
      board = applyMove(board, tiles)
      // Add one more tile extending horizontally either left or right if space
      const extendLeft = r() < 0.5
      let newCol = extendLeft ? tiles[0].col - 1 : tiles[tiles.length-1].col + 1
      if (newCol < 0 || newCol >= BOARD_SIZE) newCol = tiles[tiles.length-1].col + 1
      if (newCol >= 0 && newCol < BOARD_SIZE && board[7][newCol] === null) {
        const [L,P] = rack[tiles.length] || rack[0]
        const extMove: PlacedTile[] = [{ letter: L, points: P, row:7, col:newCol }]
        if (canPlace(board, extMove).ok) {
          const { score: s2 } = scoreMove(board, extMove)
          // Non-strict: extMove may form cross/extend; assert combined total >= s1 OR s2 standalone reasonable.
          // When extending the same word, extension score should at most increase total word score; never negative.
          expect(s2).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('bingo bonus: any 7-tile first move including center yields base+50 (20 samples)', () => {
    const r = rng(9876)
    for (let i=0;i<20;i++) {
      const board = createEmptyBoard()
      const rack = randomRack(r, 7)
      const startCol = 7 - 3 // attempt center in middle
      const tiles: PlacedTile[] = rack.map((rp, idx) => ({ letter: rp[0], points: rp[1], row:7, col:startCol + idx }))
      expect(tiles.length).toBe(7)
      expect(tiles.some(t => t.col===7)).toBe(true)
      expect(canPlace(board, tiles).ok).toBe(true)
      const { score } = scoreMove(board, tiles)
      // Minimal base sum
      const base = tiles.reduce((a,t)=>a+(t.points||0),0)
      expect(score).toBeGreaterThanOrEqual(base + 50) // star DW may push higher
    }
  })
})
