/**
 * DEPRECATION NOTICE
 * Questo modulo rimane per compatibilità test e referenze storiche.
 * Per trovare le parole formate da una mossa, usare i core helpers:
 *  - scanMainLine / scanCrossWords in `src/core/board.ts`
 *  - wrapper `findNewWordsFormed` esposto da `src/core/confirmDeps.ts`
 */
import { PlacedTile } from '@/types/game'
import { findAllWords } from './newWordFinder/scan'
import type { Board } from '@/core/board'

export interface FoundWord {
  word: string
  tiles: PlacedTile[]
  direction: 'horizontal' | 'vertical'
  startRow: number
  startCol: number
  isNewWord: boolean // True if this word contains at least one new tile
}

export const findNewWordsFormed = (board: Board, newTiles: PlacedTile[]): FoundWord[] => {
  const allTiles = new Map<string, PlacedTile>()
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const t = board[r][c]
      if (t) allTiles.set(`${r},${c}`, t)
    }
  }
  const newPos = new Set<string>()
  newTiles.forEach(t => { allTiles.set(`${t.row},${t.col}`, t); newPos.add(`${t.row},${t.col}`) })
  const allWords = findAllWords(allTiles)
  return allWords.filter(w => w.tiles.some(t => newPos.has(`${t.row},${t.col}`))).map(w => ({ ...w, isNewWord: true }))
}

// moved scanning implementation to ./newWordFinder/scan