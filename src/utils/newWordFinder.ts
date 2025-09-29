import { PlacedTile } from '@/types/game'
import { findAllWords } from './newWordFinder/scan'

export interface FoundWord {
  word: string
  tiles: PlacedTile[]
  direction: 'horizontal' | 'vertical'
  startRow: number
  startCol: number
  isNewWord: boolean // True if this word contains at least one new tile
}

export const findNewWordsFormed = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[]
): FoundWord[] => {
  // Create a combined map of existing and new tiles
  const allTiles = new Map(board)
  const newTilePositions = new Set<string>()
  
  newTiles.forEach(tile => {
    const key = `${tile.row},${tile.col}`
    allTiles.set(key, tile)
    newTilePositions.add(key)
  })

  const newWords: FoundWord[] = []

  // Find words that contain at least one new tile
  const allWords = findAllWords(allTiles)
  
  for (const word of allWords) {
    // Check if this word contains at least one new tile
    const containsNewTile = word.tiles.some(tile => {
      const key = `${tile.row},${tile.col}`
      return newTilePositions.has(key)
    })
    
    if (containsNewTile) {
      newWords.push({
        ...word,
        isNewWord: true
      })
    }
  }

  return newWords
}

// moved scanning implementation to ./newWordFinder/scan