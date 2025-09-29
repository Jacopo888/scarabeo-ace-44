import type { PlacedTile } from '@/types/game'
import type { FoundWord } from '../newWordFinder'

export const findAllWords = (allTiles: Map<string, PlacedTile>): FoundWord[] => {
  const words: FoundWord[] = []
  const processedPositions = new Set<string>()

  // Horizontal
  for (let row = 0; row < 15; row++) {
    let currentWord: PlacedTile[] = []
    let startCol = 0
    for (let col = 0; col < 15; col++) {
      const key = `${row},${col}`
      const tile = allTiles.get(key)
      if (tile) {
        if (currentWord.length === 0) startCol = col
        currentWord.push(tile)
      } else {
        if (currentWord.length > 1) {
          const wordString = currentWord.map(t => t.letter).join('')
          const positionKey = `${row}-${startCol}-horizontal`
          if (!processedPositions.has(positionKey)) {
            words.push({
              word: wordString,
              tiles: [...currentWord],
              direction: 'horizontal',
              startRow: row,
              startCol: startCol,
              isNewWord: false
            })
            processedPositions.add(positionKey)
          }
        }
        currentWord = []
      }
    }
    if (currentWord.length > 1) {
      const wordString = currentWord.map(t => t.letter).join('')
      const positionKey = `${row}-${startCol}-horizontal`
      if (!processedPositions.has(positionKey)) {
        words.push({
          word: wordString,
          tiles: [...currentWord],
          direction: 'horizontal',
          startRow: row,
          startCol: startCol,
          isNewWord: false
        })
        processedPositions.add(positionKey)
      }
    }
  }

  // Vertical
  for (let col = 0; col < 15; col++) {
    let currentWord: PlacedTile[] = []
    let startRow = 0
    for (let row = 0; row < 15; row++) {
      const key = `${row},${col}`
      const tile = allTiles.get(key)
      if (tile) {
        if (currentWord.length === 0) startRow = row
        currentWord.push(tile)
      } else {
        if (currentWord.length > 1) {
          const wordString = currentWord.map(t => t.letter).join('')
          const positionKey = `${startRow}-${col}-vertical`
          if (!processedPositions.has(positionKey)) {
            words.push({
              word: wordString,
              tiles: [...currentWord],
              direction: 'vertical',
              startRow: startRow,
              startCol: col,
              isNewWord: false
            })
            processedPositions.add(positionKey)
          }
        }
        currentWord = []
      }
    }
    if (currentWord.length > 1) {
      const wordString = currentWord.map(t => t.letter).join('')
      const positionKey = `${startRow}-${col}-vertical`
      if (!processedPositions.has(positionKey)) {
        words.push({
          word: wordString,
          tiles: [...currentWord],
          direction: 'vertical',
          startRow: startRow,
          startCol: col,
          isNewWord: false
        })
        processedPositions.add(positionKey)
      }
    }
  }

  return words
}
