import { PlacedTile } from '@/types/game'
import { getMultipliersAt } from '@/config/boardConstants'
import { scoreMove as scoreMoveCore, type Board } from '@/core/board'

// NOTE MIGRATION: Questo modulo è stato convertito per usare esclusivamente la Board matrix.
// API pubblica consolidata: calculateScore({ tiles, board })
// Rimosso supporto legacy Map(existingBoard) + funzione duplicata calculateScoreFromBoard.

export interface FoundWord {
  word: string
  tiles: PlacedTile[]
  direction: 'horizontal' | 'vertical'
  startRow: number
  startCol: number
}

export const calculateWordScore = (
  word: FoundWord,
  newTiles: PlacedTile[] = []
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
      const { letter, word } = getMultipliersAt(tile.row, tile.col)
      letterScore *= letter
      wordMultiplier *= word
    }
    
    baseScore += letterScore
  })
  
  return baseScore * wordMultiplier
}

export const calculateMoveScore = (
  words: FoundWord[],
  newTiles: PlacedTile[]
): number => {
  let totalScore = 0
  
  words.forEach(word => {
    totalScore += calculateWordScore(word, newTiles)
  })
  
  // Bonus for using all 7 tiles (BINGO!)
  if (newTiles.length === 7) {
    totalScore += 50
  }
  
  return totalScore
}

// Note: special square lookup helpers are available in '@/config/boardConstants'

// Unified scoring: calculate full move score from tiles and existing board
export interface ScoreOptions {
  tiles: PlacedTile[]
  board: Board
  context?: 'player' | 'quackle'
}

// Public unified scoring function (matrix only)
export function calculateScore(options: ScoreOptions): number {
  const { tiles, board } = options
  if (!tiles || tiles.length === 0) return 0
  const { score } = scoreMoveCore(board, tiles)
  return score
}

// Convenience helper to retrieve both score and words using the same core implementation
export function calculateScoreAndWords(options: ScoreOptions): { score: number; words: string[] } {
  const { tiles, board } = options
  if (!tiles || tiles.length === 0) return { score: 0, words: [] }
  return scoreMoveCore(board, tiles)
}

function calculateSingleTileScore(tile: PlacedTile): number {
  const mul = getMultipliersAt(tile.row, tile.col)
  const base = Number(tile.points) || 0
  return base * mul.word * mul.letter
}

// Legacy helpers kept temporarily (could be removed if unused). Adapted to matrix.
function buildFullWord(
  newTiles: PlacedTile[],
  board: Board,
  isHorizontal: boolean
): PlacedTile[] {
  if (newTiles.length === 0) return []
  const sorted = [...newTiles].sort((a, b) => (isHorizontal ? a.col - b.col : a.row - b.row))
  const row = sorted[0].row
  const col = sorted[0].col
  let minPos = isHorizontal ? Math.min(...newTiles.map(t => t.col)) : Math.min(...newTiles.map(t => t.row))
  let maxPos = isHorizontal ? Math.max(...newTiles.map(t => t.col)) : Math.max(...newTiles.map(t => t.row))

  if (isHorizontal) {
    for (let c = minPos - 1; c >= 0; c--) {
      if (board[row][c]) minPos = c; else break
    }
    for (let c = maxPos + 1; c < 15; c++) {
      if (board[row][c]) maxPos = c; else break
    }
  } else {
    for (let r = minPos - 1; r >= 0; r--) {
      if (board[r][col]) minPos = r; else break
    }
    for (let r = maxPos + 1; r < 15; r++) {
      if (board[r][col]) maxPos = r; else break
    }
  }

  const full: PlacedTile[] = []
  for (let pos = minPos; pos <= maxPos; pos++) {
    const r = isHorizontal ? row : pos
    const c = isHorizontal ? pos : col
    const newTile = newTiles.find(t => t.row === r && t.col === c)
    const existing = board[r][c]
    if (newTile) full.push(newTile)
    else if (existing) full.push(existing)
  }
  return full
}

function calculateCrossWordScore(
  tile: PlacedTile,
  board: Board,
  mainIsHorizontal: boolean
): number {
  const tiles: PlacedTile[] = [tile]
  if (mainIsHorizontal) {
    // vertical cross
    for (let r = tile.row - 1; r >= 0; r--) {
      const t = board[r][tile.col]
      if (!t) break
      tiles.unshift(t)
    }
    for (let r = tile.row + 1; r < 15; r++) {
      const t = board[r][tile.col]
      if (!t) break
      tiles.push(t)
    }
  } else {
    // horizontal cross
    for (let c = tile.col - 1; c >= 0; c--) {
      const t = board[tile.row][c]
      if (!t) break
      tiles.unshift(t)
    }
    for (let c = tile.col + 1; c < 15; c++) {
      const t = board[tile.row][c]
      if (!t) break
      tiles.push(t)
    }
  }

  if (tiles.length === 1) return 0

  let score = 0
  let wordMult = 1
  tiles.forEach(t => {
    let letterScore = Number(t.points) || 0
    if (t.row === tile.row && t.col === tile.col) {
      const mul = getMultipliersAt(t.row, t.col)
      letterScore *= mul.letter
      wordMult *= mul.word
    }
    score += letterScore
  })
  return score * wordMult
}