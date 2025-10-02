import { PlacedTile } from '@/types/game'
import { FoundWord } from './wordFinder'
import { getMultipliersAt } from '@/config/boardConstants'

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
export interface ScoreCalculationOptions {
  tiles: PlacedTile[]
  existingBoard: Map<string, PlacedTile>
  context?: 'player' | 'quackle'
}

export function calculateScore(options: ScoreCalculationOptions): number {
  const { tiles, existingBoard } = options
  if (!tiles || tiles.length === 0) return 0

  // Detect direction
  const rows = tiles.map(t => t.row)
  const cols = tiles.map(t => t.col)
  const uniqueRows = new Set(rows).size
  const uniqueCols = new Set(cols).size
  const isHorizontal = uniqueRows === 1 && uniqueCols > 1
  const isVertical = uniqueCols === 1 && uniqueRows > 1
  const isSingleTile = tiles.length === 1 || (!isHorizontal && !isVertical)

  if (isSingleTile) {
    return calculateSingleTileScore(tiles[0])
  }

  // Main word
  const mainWord = buildFullWord(tiles, existingBoard, isHorizontal)
  let mainScore = 0
  let wordMult = 1
  mainWord.forEach(tile => {
    const isNew = tiles.some(t => t.row === tile.row && t.col === tile.col)
    let letterScore = Number(tile.points) || 0
    if (isNew) {
      const mul = getMultipliersAt(tile.row, tile.col)
      letterScore *= mul.letter
      wordMult *= mul.word
    }
    mainScore += letterScore
  })

  let total = mainScore * wordMult

  // Cross-words formed by each new tile
  tiles.forEach(tile => {
    total += calculateCrossWordScore(tile, existingBoard, isHorizontal)
  })

  // Bingo
  if (tiles.length === 7) total += 50

  return total
}

function calculateSingleTileScore(tile: PlacedTile): number {
  const mul = getMultipliersAt(tile.row, tile.col)
  const base = Number(tile.points) || 0
  return base * mul.word * mul.letter
}

function buildFullWord(
  newTiles: PlacedTile[],
  existingBoard: Map<string, PlacedTile>,
  isHorizontal: boolean
): PlacedTile[] {
  const sorted = [...newTiles].sort((a, b) => (isHorizontal ? a.col - b.col : a.row - b.row))
  const row = sorted[0].row
  const col = sorted[0].col
  let minPos = isHorizontal ? Math.min(...newTiles.map(t => t.col)) : Math.min(...newTiles.map(t => t.row))
  let maxPos = isHorizontal ? Math.max(...newTiles.map(t => t.col)) : Math.max(...newTiles.map(t => t.row))

  if (isHorizontal) {
    for (let c = minPos - 1; c >= 0; c--) {
      const key = `${row},${c}`
      if (existingBoard.has(key)) minPos = c; else break
    }
    for (let c = maxPos + 1; c < 15; c++) {
      const key = `${row},${c}`
      if (existingBoard.has(key)) maxPos = c; else break
    }
  } else {
    for (let r = minPos - 1; r >= 0; r--) {
      const key = `${r},${col}`
      if (existingBoard.has(key)) minPos = r; else break
    }
    for (let r = maxPos + 1; r < 15; r++) {
      const key = `${r},${col}`
      if (existingBoard.has(key)) maxPos = r; else break
    }
  }

  const full: PlacedTile[] = []
  for (let pos = minPos; pos <= maxPos; pos++) {
    const r = isHorizontal ? row : pos
    const c = isHorizontal ? pos : col
    const key = `${r},${c}`
    const newTile = newTiles.find(t => t.row === r && t.col === c)
    const existing = existingBoard.get(key)
    if (newTile) full.push(newTile)
    else if (existing) full.push(existing)
  }
  return full
}

function calculateCrossWordScore(
  tile: PlacedTile,
  existingBoard: Map<string, PlacedTile>,
  mainIsHorizontal: boolean
): number {
  const tiles: PlacedTile[] = [tile]
  if (mainIsHorizontal) {
    // vertical cross
    for (let r = tile.row - 1; r >= 0; r--) {
      const key = `${r},${tile.col}`
      const t = existingBoard.get(key)
      if (!t) break
      tiles.unshift(t)
    }
    for (let r = tile.row + 1; r < 15; r++) {
      const key = `${r},${tile.col}`
      const t = existingBoard.get(key)
      if (!t) break
      tiles.push(t)
    }
  } else {
    // horizontal cross
    for (let c = tile.col - 1; c >= 0; c--) {
      const key = `${tile.row},${c}`
      const t = existingBoard.get(key)
      if (!t) break
      tiles.unshift(t)
    }
    for (let c = tile.col + 1; c < 15; c++) {
      const key = `${tile.row},${c}`
      const t = existingBoard.get(key)
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