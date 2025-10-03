import { PlacedTile, Tile } from '@/types/game'
import { mapToBoard } from '@/core/adapters'
import { scanMainLine, scanCrossWords } from '@/core/board'

export interface MoveValidation {
  isValid: boolean
  errors: string[]
  words: string[]
  score: number
}

export const validateMove = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[],
  isValidWordFn?: (word: string) => boolean
): MoveValidation => {
  const errors: string[] = []
  
  if (newTiles.length === 0) {
    return {
      isValid: false,
      errors: ['You must place at least one tile'],
      words: [],
      score: 0
    }
  }
  
  // Check if tiles are placed in a single row or column
  if (!areTilesInLine(newTiles)) {
    errors.push('Tiles must be placed in a single row or column')
  }
  
  // Check if tiles are adjacent to existing tiles (except first move)
  if (board.size > 0 && !areNewTilesAdjacent(board, newTiles)) {
    errors.push('New tiles must be adjacent to existing tiles')
  }
  
  // Check if first move covers center square
  if (board.size === 0 && !coversCenter(newTiles)) {
    errors.push('First move must cover the center square')
  }
  
  // Find all words formed by this move
  // Ricava parole formate usando il core (main + cross) e unisci in lista unica
  const matrix = mapToBoard(board)
  const main = scanMainLine(matrix, newTiles)
  const crosses = scanCrossWords(matrix, newTiles)
  const words: string[] = []
  if (main.length > 1 || (main.length === 1 && crosses.length === 0)) {
    words.push(main.map(t => t.letter).join(''))
  }
  for (const line of crosses) words.push(line.map(t => t.letter).join(''))
  const wordStrings = Array.from(new Set(words)).filter(Boolean)
  
  // Validate all words in dictionary if validator provided
  if (isValidWordFn) {
    const invalidWords = wordStrings.filter(word => !isValidWordFn(word))
    if (invalidWords.length > 0) {
      errors.push(`Invalid words: ${invalidWords.join(', ')}`)
    }
  }
  
  // Check if at least one word is formed
  if (wordStrings.length === 0) {
    errors.push('You must form at least one word')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    words: wordStrings,
    score: 0 // Will be calculated separately
  }
}

const areTilesInLine = (tiles: PlacedTile[]): boolean => {
  if (tiles.length <= 1) return true
  
  // Check if all tiles are in the same row
  const sameRow = tiles.every(tile => tile.row === tiles[0].row)
  if (sameRow) {
    // Check if tiles are consecutive
    const cols = tiles.map(t => t.col).sort((a, b) => a - b)
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] - cols[i - 1] > 1) {
        // Check if there's an existing tile filling the gap
        // This would need access to the board state
      }
    }
    return true
  }
  
  // Check if all tiles are in the same column
  const sameCol = tiles.every(tile => tile.col === tiles[0].col)
  if (sameCol) {
    // Check if tiles are consecutive
    const rows = tiles.map(t => t.row).sort((a, b) => a - b)
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] - rows[i - 1] > 1) {
        // Check if there's an existing tile filling the gap
        // This would need access to the board state
      }
    }
    return true
  }
  
  return false
}

const areNewTilesAdjacent = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[]
): boolean => {
  return newTiles.some(tile => {
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1] // up, down, left, right
    ]
    
    return directions.some(([dRow, dCol]) => {
      const adjacentKey = `${tile.row + dRow},${tile.col + dCol}`
      return board.has(adjacentKey)
    })
  })
}

const coversCenter = (tiles: PlacedTile[]): boolean => {
  return tiles.some(tile => tile.row === 7 && tile.col === 7)
}

export const canEndGame = (
  players: Array<{ rack: Tile[] }>,
  tileBag: Tile[],
  passCount = 0,
  noMovesAvailable = false
): boolean => {
  // Game ends when:
  // 1. A player uses all their tiles and the bag is empty
  if (tileBag.length === 0 && players.some(player => player.rack.length === 0)) return true
  // 2. Consecutive passes across the game reach 2 per player (e.g., for 2 players: 4 total consecutive passes)
  //    Note: passCount is the total number of consecutive passes since the last non-pass move.
  if (passCount >= players.length * 2) return true
  // 3. No more valid moves possible
  if (noMovesAvailable) return true
  return false
}

export const calculateEndGamePenalty = (rack: Tile[]): number => {
  return rack.reduce((total, tile) => total + tile.points, 0)
}
