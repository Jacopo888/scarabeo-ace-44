import type { PlacedTile } from '@/types/game'
import type { Board } from '@/core/board'

export interface FoundWord {
  word: string
  tiles: PlacedTile[]
  direction: 'horizontal' | 'vertical'
  startRow: number
  startCol: number
  isNewWord?: boolean
}

// Accept legacy Map or new Board matrix
export const findAllWords = (allTiles: Map<string, PlacedTile> | Board): FoundWord[] => {
  const get = (r: number, c: number): PlacedTile | undefined => {
    if (Array.isArray(allTiles)) {
      if (r < 0 || r >= 15 || c < 0 || c >= 15) return undefined
      return allTiles[r][c] || undefined
    }
    return allTiles.get(`${r},${c}`)
  }
  const words: FoundWord[] = []
  const processedPositions = new Set<string>()

  // Horizontal
  for (let row = 0; row < 15; row++) {
    let currentWord: PlacedTile[] = []
    let startCol = 0
    for (let col = 0; col < 15; col++) {
  const tile = get(row, col)
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
  const tile = get(row, col)
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
