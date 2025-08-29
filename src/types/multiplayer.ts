export interface Profile {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  games_played: number
  games_won: number
  total_score: number
  skill_level: number
  preferred_game_duration: '1h' | '6h' | '24h' | '48h'
  created_at: string
  updated_at: string
}

import { PlacedTile, Tile } from './game'

export interface GameRecord {
  id: string
  player1_id: string
  player2_id: string
  current_player_id: string
  status: 'waiting' | 'active' | 'completed' | 'abandoned'
  winner_id?: string
  board_state: Record<string, PlacedTile>
  tile_bag: Tile[]
  player1_rack: Tile[]
  player2_rack: Tile[]
  player1_score: number
  player2_score: number
  turn_deadline?: string
  turn_duration: '1h' | '6h' | '24h' | '48h'
  pass_count: number
  created_at: string
  updated_at: string
  player1?: Pick<Profile, 'username' | 'display_name'>
  player2?: Pick<Profile, 'username' | 'display_name'>
}

export interface MoveRecord {
  id: string
  game_id: string
  player_id: string
  move_type: 'place_tiles' | 'exchange_tiles' | 'pass' | 'resign'
  tiles_placed: PlacedTile[]
  tiles_exchanged: Tile[]
  words_formed: string[]
  score_earned: number
  board_state_after: Record<string, PlacedTile>
  rack_after: Tile[]
  created_at: string
}

export interface MatchmakingEntry {
  id: string
  user_id: string
  skill_level: number
  preferred_duration: '1h' | '6h' | '24h' | '48h'
  created_at: string
}