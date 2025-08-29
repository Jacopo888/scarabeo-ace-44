import { PlacedTile } from '@/types/game'

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

const findAllWords = (allTiles: Map<string, PlacedTile>): FoundWord[] => {
  const words: FoundWord[] = []
  const processedPositions = new Set<string>()

  // Find horizontal words
  for (let row = 0; row < 15; row++) {
    let currentWord: PlacedTile[] = []
    let startCol = 0

    for (let col = 0; col < 15; col++) {
      const key = `${row},${col}`
      const tile = allTiles.get(key)

      if (tile) {
        if (currentWord.length === 0) {
          startCol = col
        }
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

    // Check for word at end of row
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

  // Find vertical words
  for (let col = 0; col < 15; col++) {
    let currentWord: PlacedTile[] = []
    let startRow = 0

    for (let row = 0; row < 15; row++) {
      const key = `${row},${col}`
      const tile = allTiles.get(key)

      if (tile) {
        if (currentWord.length === 0) {
          startRow = row
        }
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

    // Check for word at end of column
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