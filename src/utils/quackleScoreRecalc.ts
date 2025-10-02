/**
 * Recalculate Quackle move score using our board multipliers
 * 
 * Quackle's bridge may return incorrect scores that don't account for
 * board multipliers properly. This function recalculates the score
 * using our known special squares.
 */

import type { PlacedTile } from '@/types/game'

// Special square multipliers (same as scoring.ts)
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

/**
 * Recalculate score for Quackle move considering board multipliers
 * 
 * This assumes all tiles in the array are NEW tiles being placed
 * (Quackle only returns newly placed tiles, not existing board tiles)
 */
export function recalculateQuackleScore(
  tiles: PlacedTile[],
  existingBoard: Map<string, PlacedTile>
): number {
  if (!tiles || tiles.length === 0) return 0

  // Determine move direction
  const rows = tiles.map(t => t.row)
  const cols = tiles.map(t => t.col)
  const uniqueRows = new Set(rows).size
  const uniqueCols = new Set(cols).size
  
  const isHorizontal = uniqueRows === 1 && uniqueCols > 1
  const isVertical = uniqueCols === 1 && uniqueRows > 1
  
  if (!isHorizontal && !isVertical) {
    // Single tile - just calculate with multipliers
    return calculateSingleTileScore(tiles[0])
  }

  // Calculate main word score
  let mainWordScore = 0
  let wordMultiplier = 1
  
  // For horizontal/vertical moves, we need to consider the full word
  // including any tiles already on the board
  const mainWord = buildFullWord(tiles, existingBoard, isHorizontal)
  
  mainWord.forEach(tile => {
    const position = `${tile.row},${tile.col}`
    let letterScore = tile.points || 0
    
    // Only apply multipliers to NEW tiles (those in the tiles array)
    const isNewTile = tiles.some(t => t.row === tile.row && t.col === tile.col)
    
    if (isNewTile) {
      const special = SPECIAL_SQUARES[position as keyof typeof SPECIAL_SQUARES]
      
      switch (special) {
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
    
    mainWordScore += letterScore
  })
  
  let totalScore = mainWordScore * wordMultiplier
  
  // Add cross-word scores (perpendicular words formed by each new tile)
  tiles.forEach(tile => {
    const crossScore = calculateCrossWordScore(tile, existingBoard, isHorizontal)
    totalScore += crossScore
  })
  
  // Bonus for using all 7 tiles (BINGO!)
  if (tiles.length === 7) {
    totalScore += 50
  }
  
  return totalScore
}

function calculateSingleTileScore(tile: PlacedTile): number {
  const position = `${tile.row},${tile.col}`
  let score = tile.points || 0
  let wordMultiplier = 1
  
  const special = SPECIAL_SQUARES[position as keyof typeof SPECIAL_SQUARES]
  
  switch (special) {
    case 'TL':
      score *= 3
      break
    case 'DL':
      score *= 2
      break
    case 'TW':
      wordMultiplier = 3
      break
    case 'DW':
      wordMultiplier = 2
      break
  }
  
  return score * wordMultiplier
}

function buildFullWord(
  newTiles: PlacedTile[],
  existingBoard: Map<string, PlacedTile>,
  isHorizontal: boolean
): PlacedTile[] {
  // Sort tiles by position
  const sorted = [...newTiles].sort((a, b) => 
    isHorizontal ? a.col - b.col : a.row - b.row
  )
  
  const row = sorted[0].row
  const col = sorted[0].col
  let minPos = isHorizontal ? Math.min(...newTiles.map(t => t.col)) : Math.min(...newTiles.map(t => t.row))
  let maxPos = isHorizontal ? Math.max(...newTiles.map(t => t.col)) : Math.max(...newTiles.map(t => t.row))
  
  // Expand to include existing tiles before and after
  if (isHorizontal) {
    // Check tiles to the left
    for (let c = minPos - 1; c >= 0; c--) {
      const key = `${row},${c}`
      if (existingBoard.has(key)) {
        minPos = c
      } else {
        break
      }
    }
    // Check tiles to the right
    for (let c = maxPos + 1; c < 15; c++) {
      const key = `${row},${c}`
      if (existingBoard.has(key)) {
        maxPos = c
      } else {
        break
      }
    }
  } else {
    // Check tiles above
    for (let r = minPos - 1; r >= 0; r--) {
      const key = `${r},${col}`
      if (existingBoard.has(key)) {
        minPos = r
      } else {
        break
      }
    }
    // Check tiles below
    for (let r = maxPos + 1; r < 15; r++) {
      const key = `${r},${col}`
      if (existingBoard.has(key)) {
        maxPos = r
      } else {
        break
      }
    }
  }
  
  const fullWord: PlacedTile[] = []
  
  for (let pos = minPos; pos <= maxPos; pos++) {
    const r = isHorizontal ? row : pos
    const c = isHorizontal ? pos : col
    const key = `${r},${c}`
    
    // Check if it's a new tile or existing
    const newTile = newTiles.find(t => t.row === r && t.col === c)
    const existingTile = existingBoard.get(key)
    
    if (newTile) {
      fullWord.push(newTile)
    } else if (existingTile) {
      fullWord.push(existingTile)
    }
  }
  
  return fullWord
}

function calculateCrossWordScore(
  tile: PlacedTile,
  existingBoard: Map<string, PlacedTile>,
  mainIsHorizontal: boolean
): number {
  // Check perpendicular direction
  const checkDirection = mainIsHorizontal ? 'vertical' : 'horizontal'
  const crossTiles: PlacedTile[] = [tile]
  
  if (checkDirection === 'vertical') {
    // Check up
    for (let r = tile.row - 1; r >= 0; r--) {
      const key = `${r},${tile.col}`
      const t = existingBoard.get(key)
      if (!t) break
      crossTiles.unshift(t)
    }
    // Check down
    for (let r = tile.row + 1; r < 15; r++) {
      const key = `${r},${tile.col}`
      const t = existingBoard.get(key)
      if (!t) break
      crossTiles.push(t)
    }
  } else {
    // Check left
    for (let c = tile.col - 1; c >= 0; c--) {
      const key = `${tile.row},${c}`
      const t = existingBoard.get(key)
      if (!t) break
      crossTiles.unshift(t)
    }
    // Check right
    for (let c = tile.col + 1; c < 15; c++) {
      const key = `${tile.row},${c}`
      const t = existingBoard.get(key)
      if (!t) break
      crossTiles.push(t)
    }
  }
  
  // If no cross word formed (only the tile itself), return 0
  if (crossTiles.length === 1) return 0
  
  // Calculate cross word score
  let score = 0
  let wordMult = 1
  
  crossTiles.forEach(t => {
    const position = `${t.row},${t.col}`
    let letterScore = t.points || 0
    
    // Only apply multipliers to the NEW tile
    if (t.row === tile.row && t.col === tile.col) {
      const special = SPECIAL_SQUARES[position as keyof typeof SPECIAL_SQUARES]
      
      switch (special) {
        case 'TL':
          letterScore *= 3
          break
        case 'DL':
          letterScore *= 2
          break
        case 'TW':
          wordMult *= 3
          break
        case 'DW':
          wordMult *= 2
          break
      }
    }
    
    score += letterScore
  })
  
  return score * wordMult
}
