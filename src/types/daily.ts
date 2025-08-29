import { PlacedTile, Tile } from './game'

export interface DailyPuzzle {
  id: string
  yyyymmdd: number
  board: PlacedTile[]
  rack: Tile[]
  best_score: number
  created_at?: string
}

export interface DailyScore {
  id: string
  user_id: string
  yyyymmdd: number
  score: number
  created_at?: string
}

export interface DailyLeaderboardEntry {
  user_id: string
  score: number
  created_at?: string
}