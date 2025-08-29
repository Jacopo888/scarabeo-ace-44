import { Tile, PlacedTile } from './game'

export interface PuzzleMove {
  tiles: PlacedTile[]
  words: string[]
  score: number
  startCell?: { row: number, col: number }
  mainWordLength?: number
  lettersUsed?: string[]
}

export interface Puzzle {
  id: string
  board: PlacedTile[]  // Only occupied cells
  rack: Tile[]
  topMoves: PuzzleMove[]
}

export interface PuzzleGameState {
  puzzle: Puzzle | null
  foundMoves: Set<string>
  pendingTiles: PlacedTile[]
  remainingRack: Tile[]
  isGameOver: boolean
  totalScore: number
  hints: {
    currentMoveIndex: number
    anchorRevealed: boolean
    lengthRevealed: boolean
    lettersRevealed: boolean
  }
}