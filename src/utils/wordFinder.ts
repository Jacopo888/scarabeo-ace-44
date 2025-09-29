import { PlacedTile } from '@/types/game'
import { findAllWords as scanAllWords } from './newWordFinder/scan'

export interface FoundWord {
  word: string
  tiles: PlacedTile[]
  direction: 'horizontal' | 'vertical'
  startRow: number
  startCol: number
}

export const findWordsOnBoard = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[] = []
): FoundWord[] => {
  // Unifica board + nuove tessere come fa newWordFinder
  const allTiles = new Map(board)
  for (const t of newTiles) allTiles.set(`${t.row},${t.col}`, t)

  // Riusa lo scanner condiviso, quindi adatta al tipo locale (senza isNewWord)
  const words = scanAllWords(allTiles)
  return words.map(w => ({
    word: w.word,
    tiles: w.tiles,
    direction: w.direction,
    startRow: w.startRow,
    startCol: w.startCol
  }))
}