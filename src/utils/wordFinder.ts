import { PlacedTile } from '@/types/game'
import { findAllWords as scanAllWords } from './newWordFinder/scan'
import type { Board } from '@/core/board'

export interface FoundWord {
  word: string
  tiles: PlacedTile[]
  direction: 'horizontal' | 'vertical'
  startRow: number
  startCol: number
}

export const findWordsOnBoard = (board: Board, newTiles: PlacedTile[] = []): FoundWord[] => {
  // Costruisce una mappa temporanea solo per lo scanner legacy (può essere ottimizzata se necessario)
  const allTiles = new Map<string, PlacedTile>()
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const t = board[r][c]
      if (t) allTiles.set(`${r},${c}`, t)
    }
  }
  for (const t of newTiles) allTiles.set(`${t.row},${t.col}`, t)
  const words = scanAllWords(allTiles)
  return words.map(w => ({ word: w.word, tiles: w.tiles, direction: w.direction, startRow: w.startRow, startCol: w.startCol }))
}