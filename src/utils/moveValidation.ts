import { PlacedTile } from '@/types/game'

export interface MoveValidation {
  isValid: boolean
  errors: string[]
}

export const validateMoveLogic = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[]
): MoveValidation => {
  const errors: string[] = []
  
  if (newTiles.length === 0) {
    return {
      isValid: false,
      errors: ['You must place at least one tile']
    }
  }
  
  // Check if tiles are placed on empty squares
  for (const tile of newTiles) {
    const key = `${tile.row},${tile.col}`
    if (board.has(key)) {
      errors.push('Cannot place tile on occupied square')
    }
  }

  const contiguous = areNewTilesContiguous(newTiles)
  const gapsFilled = areGapsFilledByExistingTiles(board, newTiles)

  // Check if tiles are contiguous
  if (newTiles.length > 1 && !contiguous && !gapsFilled) {
    errors.push('All new tiles must be adjacent to each other')
  }
  
  // Check if tiles are in a single line
  if (!areTilesInSingleLine(newTiles)) {
    errors.push('Tiles must be placed in a single row or column')
  }
  
  // Check if first move covers center square
  if (board.size === 0 && !coversCenter(newTiles)) {
    errors.push('First move must cover the center square')
  }
  
  // Check if tiles are adjacent to existing tiles (except first move)
  if (board.size > 0 && !areNewTilesAdjacentToBoard(board, newTiles)) {
    errors.push('New tiles must be adjacent to existing tiles')
  }
  
  // Check if gaps are filled by existing tiles
  if (!gapsFilled) {
    errors.push('Gaps between new tiles must be filled by existing tiles')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

const areNewTilesContiguous = (newTiles: PlacedTile[]): boolean => {
  if (newTiles.length <= 1) return true
  
  // Sort tiles by position
  const sortedTiles = [...newTiles].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  
  // Check if tiles form a contiguous line
  const isHorizontal = sortedTiles.every(tile => tile.row === sortedTiles[0].row)
  const isVertical = sortedTiles.every(tile => tile.col === sortedTiles[0].col)
  
  if (isHorizontal) {
    // Check horizontal contiguity
    for (let i = 1; i < sortedTiles.length; i++) {
      if (sortedTiles[i].col - sortedTiles[i-1].col > 1) {
        return false
      }
    }
    return true
  } else if (isVertical) {
    // Check vertical contiguity
    for (let i = 1; i < sortedTiles.length; i++) {
      if (sortedTiles[i].row - sortedTiles[i-1].row > 1) {
        return false
      }
    }
    return true
  }
  
  return false
}

const areTilesInSingleLine = (tiles: PlacedTile[]): boolean => {
  if (tiles.length <= 1) return true
  
  // Check if all tiles are in the same row
  const sameRow = tiles.every(tile => tile.row === tiles[0].row)
  
  // Check if all tiles are in the same column
  const sameCol = tiles.every(tile => tile.col === tiles[0].col)
  
  return sameRow || sameCol
}

const areNewTilesAdjacentToBoard = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[]
): boolean => {
  return newTiles.some(tile => {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    
    return directions.some(([dRow, dCol]) => {
      const adjacentKey = `${tile.row + dRow},${tile.col + dCol}`
      return board.has(adjacentKey)
    })
  })
}

const areGapsFilledByExistingTiles = (
  board: Map<string, PlacedTile>,
  newTiles: PlacedTile[]
): boolean => {
  if (newTiles.length <= 1) return true
  
  const sortedTiles = [...newTiles].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  
  const isHorizontal = sortedTiles.every(tile => tile.row === sortedTiles[0].row)
  
  if (isHorizontal) {
    // Check horizontal gaps
    for (let i = 1; i < sortedTiles.length; i++) {
      const prevCol = sortedTiles[i-1].col
      const currentCol = sortedTiles[i].col
      
      // Check if all positions between are filled by existing tiles
      for (let col = prevCol + 1; col < currentCol; col++) {
        const key = `${sortedTiles[0].row},${col}`
        if (!board.has(key)) {
          return false
        }
      }
    }
  } else {
    // Check vertical gaps
    for (let i = 1; i < sortedTiles.length; i++) {
      const prevRow = sortedTiles[i-1].row
      const currentRow = sortedTiles[i].row
      
      // Check if all positions between are filled by existing tiles
      for (let row = prevRow + 1; row < currentRow; row++) {
        const key = `${row},${sortedTiles[0].col}`
        if (!board.has(key)) {
          return false
        }
      }
    }
  }
  
  return true
}

const coversCenter = (tiles: PlacedTile[]): boolean => {
  return tiles.some(tile => tile.row === 7 && tile.col === 7)
}