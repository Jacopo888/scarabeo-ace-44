import { GameState, Tile, PlacedTile } from '@/types/game'
import { Difficulty } from '@/components/DifficultyModal'

export interface QuackleMove {
  tiles: PlacedTile[]
  score: number
  words: string[]
  move_type: 'place' | 'exchange' | 'pass'
}

const QUACKLE_SERVICE_URL = import.meta.env.VITE_QUACKLE_SERVICE_URL || 'http://localhost:5000'

export async function getBestMove(
  gameState: GameState,
  rack: Tile[],
  difficulty: Difficulty
): Promise<QuackleMove | null> {
  try {
    // Convert board to plain object for JSON serialization
    const boardObject: Record<string, any> = {}
    gameState.board.forEach((tile, key) => {
      boardObject[key] = {
        letter: tile.letter,
        points: tile.points,
        row: tile.row,
        col: tile.col,
        isBlank: tile.isBlank || false
      }
    })

    const response = await fetch(`${QUACKLE_SERVICE_URL}/best-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board: boardObject,
        rack: rack.map(tile => ({
          letter: tile.letter,
          points: tile.points,
          isBlank: tile.isBlank || false
        })),
        difficulty
      })
    })

    if (!response.ok) {
      console.error('Quackle service error:', response.status, response.statusText)
      return null
    }

    const move = await response.json()
    
    // Validate move structure
    if (!move || typeof move.score !== 'number') {
      console.error('Invalid move response from Quackle:', move)
      return null
    }

    return {
      tiles: move.tiles || [],
      score: move.score,
      words: move.words || [],
      move_type: move.move_type || 'place'
    }
  } catch (error) {
    console.error('Error calling Quackle service:', error)
    return null
  }
}

export async function checkQuackleHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${QUACKLE_SERVICE_URL}/health`)
    return response.ok
  } catch (error) {
    console.error('Quackle health check failed:', error)
    return false
  }
}