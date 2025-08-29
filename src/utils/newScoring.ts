import { PlacedTile } from '@/types/game'
import { FoundWord } from './newWordFinder'

// Special square multipliers
const SPECIAL_SQUARES = {
  // Triple Word Score
  "0,0": "TW", "0,7": "TW", "0,14": "TW",
  "7,0": "TW", "7,14": "TW",
  "14,0": "TW", "14,7": "TW", "14,14": "TW",
  
  // Double Word Score  
  "1,1": "DW", "1,13": "DW",
  "2,2": "DW", "2,12": "DW",
  "3,3": "DW", "3,11": "DW",
  "4,4": "DW", "4,10": "DW",
  "10,4": "DW", "10,10": "DW",
  "11,3": "DW", "11,11": "DW",
  "12,2": "DW", "12,12": "DW",
  "13,1": "DW", "13,13": "DW",
  
  // Triple Letter Score
  "1,5": "TL", "1,9": "TL",
  "5,1": "TL", "5,5": "TL", "5,9": "TL", "5,13": "TL",
  "9,1": "TL", "9,5": "TL", "9,9": "TL", "9,13": "TL",
  "13,5": "TL", "13,9": "TL",
  
  // Double Letter Score
  "0,3": "DL", "0,11": "DL",
  "2,6": "DL", "2,8": "DL",
  "3,0": "DL", "3,7": "DL", "3,14": "DL",
  "6,2": "DL", "6,6": "DL", "6,8": "DL", "6,12": "DL",
  "7,3": "DL", "7,11": "DL",
  "8,2": "DL", "8,6": "DL", "8,8": "DL", "8,12": "DL",
  "11,0": "DL", "11,7": "DL", "11,14": "DL",
  "12,6": "DL", "12,8": "DL",
  "14,3": "DL", "14,11": "DL",
  
  // Star (center) - counts as DW
  "7,7": "DW"
} as const

export const calculateNewWordScore = (
  word: FoundWord,
  newTiles: PlacedTile[]
): number => {
  let baseScore = 0
  let wordMultiplier = 1
  
  // Create a set of new tile positions for quick lookup
  const newTilePositions = new Set(
    newTiles.map(tile => `${tile.row},${tile.col}`)
  )
  
  // Calculate base score with letter multipliers
  word.tiles.forEach(tile => {
    const position = `${tile.row},${tile.col}`
    let letterScore = Number(tile.points) || 0
    
    // Apply special square bonuses only for newly placed tiles
    if (newTilePositions.has(position)) {
      const specialSquare = SPECIAL_SQUARES[position as keyof typeof SPECIAL_SQUARES]
      
      switch (specialSquare) {
        case 'TL':
          letterScore *= 3
          break
        case 'DL':
          letterScore *= 2
          break
        case 'TW':
          wordMultiplier *= 3
          break
        case 'DW':
          wordMultiplier *= 2
          break
      }
    }
    
    baseScore += letterScore
  })
  
  return baseScore * wordMultiplier
}

export const calculateNewMoveScore = (
  newWords: FoundWord[],
  newTiles: PlacedTile[]
): number => {
  let totalScore = 0
  
  // Score only the new words formed
  newWords.forEach(word => {
    totalScore += calculateNewWordScore(word, newTiles)
  })
  
  // Bonus for using all 7 tiles (BINGO!)
  if (newTiles.length === 7) {
    totalScore += 50
  }
  
  return totalScore
}

export const getSpecialSquareType = (row: number, col: number): string | null => {
  const key = `${row},${col}` as keyof typeof SPECIAL_SQUARES
  return SPECIAL_SQUARES[key] || null
}